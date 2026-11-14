import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { aliquotaEfetiva, estimarRecuperacao, faixaAnexoI, janela, pisCofinsRevenda, prazoRestituicao } from "../src/recuperacao.ts";

const R = (reais: number) => Math.round(reais * 100);
const perto = (v: number, esperado: number, tol = 1e-9) => assert.ok(Math.abs(v - esperado) <= tol, `${v} longe de ${esperado}`);

test("faixas do Anexo I pela RBT12", () => {
  assert.equal(faixaAnexoI(R(180_000)).numero, 1);
  assert.equal(faixaAnexoI(R(180_000.01)).numero, 2);
  assert.equal(faixaAnexoI(R(1_200_000)).numero, 4);
  assert.equal(faixaAnexoI(R(4_800_000)).numero, 6);
  assert.equal(faixaAnexoI(R(9_000_000)).numero, 6, "acima do limite fica na última faixa");
});

test("alíquota efetiva e PIS + COFINS da revenda", () => {
  // RBT12 R$ 1,2 mi: faixa 4, (1.200.000 × 10,7% − 22.500) / 1.200.000 = 8,825%
  perto(aliquotaEfetiva(R(1_200_000)), 0.08825);
  // PIS 2,76% + COFINS 12,74% da partilha = 15,5% da efetiva
  perto(pisCofinsRevenda(R(1_200_000)), 0.08825 * 0.155);
  // Faixa 1 e início de atividade: a nominal de 4%
  perto(aliquotaEfetiva(R(100_000)), 0.04);
  perto(aliquotaEfetiva(0), 0.04);
  // Faixa 6: partilha própria (PIS 6,13% + COFINS 28,27%)
  perto(pisCofinsRevenda(R(4_000_000)), ((4_000_000 * 0.19 - 378_000) / 4_000_000) * 0.344);
});

test("prazo: vencimento do DAS + 5 anos", () => {
  assert.equal(prazoRestituicao("2026-11"), "2031-12-20");
  assert.equal(prazoRestituicao("2026-12"), "2032-01-20");
  assert.equal(prazoRestituicao("2022-01"), "2027-02-20");
});

test("janela de 60 meses", () => {
  const j = janela("2026-12", 60);
  assert.equal(j.length, 60);
  assert.equal(j[0], "2022-01");
  assert.equal(j[59], "2026-12");
  assert.deepEqual(janela("2026-02", 3), ["2025-12", "2026-01", "2026-02"]);
});

test("pago a mais, parte já segregada e meses fora da janela", () => {
  const r = estimarRecuperacao(
    [
      { competencia: "2026-10", rbt12Cent: R(1_200_000), receitaMonofasicaCent: R(40_000) },
      { competencia: "2026-09", rbt12Cent: R(1_200_000), receitaMonofasicaCent: R(40_000), jaSegregadaCent: R(30_000) },
      { competencia: "2026-08", rbt12Cent: R(1_200_000), receitaMonofasicaCent: R(40_000), jaSegregadaCent: R(50_000) },
      { competencia: "2021-12", rbt12Cent: R(1_200_000), receitaMonofasicaCent: R(40_000) }, // fora dos 60 meses
      { competencia: "2027-01", rbt12Cent: R(1_200_000), receitaMonofasicaCent: R(40_000) }, // já é CBS/IBS
    ],
    "2027-06",
    "2026-11-14",
  );
  assert.deepEqual(r.linhas.map((l) => l.competencia), ["2026-08", "2026-09", "2026-10"]);
  const taxa = 0.08825 * 0.155;
  assert.equal(r.linhas[2].pagoAMaisCent, Math.round(R(40_000) * taxa), "R$ 547,15");
  assert.equal(r.linhas[2].pagoAMaisCent, 54715);
  assert.equal(r.linhas[1].baseCent, R(10_000));
  assert.equal(r.linhas[0].pagoAMaisCent, 0, "base nunca negativa");
  assert.equal(r.noPrazoCent, r.linhas.reduce((s, l) => s + l.pagoAMaisCent, 0));
});

test("prescrição: o que passou do prazo sai do total no prazo", () => {
  const r = estimarRecuperacao(
    [
      { competencia: "2022-01", rbt12Cent: R(500_000), receitaMonofasicaCent: R(10_000) },
      { competencia: "2022-02", rbt12Cent: R(500_000), receitaMonofasicaCent: R(10_000) },
    ],
    "2026-12",
    "2027-03-01",
  );
  assert.equal(r.linhas[0].situacao, "vencido", "prazo 2027-02-20");
  assert.equal(r.linhas[1].situacao, "no_prazo", "prazo 2027-03-20");
  assert.equal(r.vencidoCent, r.linhas[0].pagoAMaisCent);
  assert.equal(r.noPrazoCent, r.linhas[1].pagoAMaisCent);
});

test("CLI com os exemplos sintéticos", () => {
  const raiz = path.resolve(import.meta.dirname, "..");
  const tsx = path.join(raiz, "node_modules", "tsx", "dist", "cli.mjs");
  const run = (...a: string[]) => JSON.parse(execFileSync(process.execPath, [tsx, "src/cli.ts", ...a, "--json"], { cwd: raiz, encoding: "utf8" }));
  const itens = run("ncm", "--arquivo", "exemplos/itens.csv") as Array<{ situacao: string }>;
  assert.deepEqual(
    ["sim", "confirmar", "nao"].map((s) => itens.filter((i) => i.situacao === s).length),
    [4, 4, 4],
  );
  const rec = run("recuperar", "exemplos/receitas.csv", "--hoje", "2026-11-14");
  assert.equal(rec.linhas.length, 16);
  assert.equal(rec.vencidoCent, 0);
  assert.ok(rec.noPrazoCent > 0);
});
