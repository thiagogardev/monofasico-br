import assert from "node:assert/strict";
import test from "node:test";
import { classificar, conferirPelaCompra, exInformado, segregaPisCofins } from "../src/classificar.ts";
import { GRUPOS_MONOFASICO } from "../src/tabela.ts";

const sit = (ncm: string, ex?: string) => classificar({ ncm, ex }).situacao;

test("produtos monofásicos pela lei e pelo SPED", () => {
  assert.equal(sit("30049099"), "sim", "medicamento");
  assert.equal(sit("33051000"), "sim", "xampu");
  assert.equal(sit("34011190"), "sim", "sabonete");
  assert.equal(sit("40111000"), "sim", "pneu");
  assert.equal(sit("40131000"), "sim", "câmara de ar");
  assert.equal(sit("87089990"), "sim", "parte de veículo, Anexo I");
  assert.equal(sit("27101921"), "sim", "diesel");
  assert.equal(sit("87032310"), "sim", "automóvel");
  assert.equal(sit("4011.10.00"), "sim", "NCM com pontos");
});

test("exceções expressas da lei", () => {
  assert.equal(sit("30049046"), "nao", "exceção da Lei 10.147");
  assert.equal(sit("30039056"), "nao", "exceção da Lei 10.147");
  assert.equal(sit("34011190", "01"), "nao", "3401.11.90 Ex 01 excluído");
});

test("a 33.06 (higiene bucal) está fora desde a Lei 12.839/2013, embora o SPED ainda a liste", () => {
  assert.equal(sit("33061000"), "nao");
  assert.equal(sit("33069000"), "nao");
});

test("regra do maior prefixo: o Anexo I (8431.41.00) vence o Anexo II", () => {
  const c = classificar({ ncm: "84314100" });
  assert.equal(c.situacao, "sim");
  assert.equal(c.grupo, "autopecas_anexo_i");
  assert.equal(classificar({ ncm: "84314990" }).grupo, "autopecas_anexo_ii");
});

test("Anexo II da IN RFB 2.121 fica a confirmar (condição de uso)", () => {
  const c = classificar({ ncm: "40093100" });
  assert.equal(c.situacao, "confirmar", "mangueira: depende do uso");
  assert.match(c.motivo, /84\.29/);
  assert.equal(sit("84314990"), "confirmar", "outras partes da 8431.49");
});

test("erro achado com dados reais: 8431.43 é parte de máquina de sondagem ou perfuração, não da 84.29", () => {
  assert.equal(sit("84314390"), "nao");
  assert.equal(sit("84314310"), "nao");
  assert.equal(sit("84313900"), "nao", "8431.39: partes de máquinas da 84.28");
  assert.equal(sit("84311010"), "nao", "8431.10: partes de máquinas da 84.25");
});

test("Ex da TIPI: só no Ex exigido; sem Ex fica a confirmar", () => {
  assert.equal(sit("84818099"), "confirmar", "válvula: só no Ex 01 ou 02, e a nota não traz o Ex");
  assert.equal(sit("84818099", "1"), "sim", "Ex 01 sem zero à esquerda");
  assert.equal(sit("84818099", "02"), "sim");
  assert.equal(sit("84818099", "03"), "nao", "outro Ex");
});

test("erro achado com dados reais: EXTIPI '0' é o mesmo que sem Ex", () => {
  assert.equal(exInformado("0"), null);
  assert.equal(exInformado("00"), null);
  assert.equal(exInformado("000"), null);
  assert.equal(exInformado(""), null);
  assert.equal(exInformado(undefined), null);
  assert.equal(exInformado("1"), "01");
  assert.equal(exInformado("001"), "01");
  assert.equal(sit("84818099", "0"), "confirmar", "antes da correção, '0' virava Ex 00 e o item saía como não");
  assert.equal(sit("84818099", "000"), "confirmar");
  assert.equal(sit("34011190", "0"), "sim", "sem Ex, o sabonete continua monofásico");
});

test("bebidas frias ficam a confirmar", () => {
  assert.equal(sit("22030000"), "confirmar", "cerveja");
  assert.equal(sit("22021000"), "confirmar", "refrigerante");
});

test("fora da lista e NCM inválido", () => {
  assert.equal(sit("39269090"), "nao");
  assert.equal(sit("73181500"), "nao");
  assert.equal(sit("4009"), "nao", "NCM incompleto");
  assert.equal(classificar({ ncm: null }).motivo, "item sem NCM de 8 dígitos");
});

test("conferência pela compra: CST 02/03/04 do fornecedor só põe em a confirmar", () => {
  const fora = classificar({ ncm: "39269090" });
  assert.equal(conferirPelaCompra(fora, "39269090", ["04"]).situacao, "confirmar");
  assert.match(conferirPelaCompra(fora, "39269090", ["4"]).motivo, /CST de PIS 04/);
  assert.equal(conferirPelaCompra(fora, "39269090", ["01", "06"]).situacao, "nao", "CST de tributação normal não muda nada");
  assert.equal(conferirPelaCompra(fora, "39269090", []).situacao, "nao");
  const sim = classificar({ ncm: "40111000" });
  assert.deepEqual(conferirPelaCompra(sim, "40111000", ["01"]), sim, "o CST nunca rebaixa um sim");
  const conf = classificar({ ncm: "40093100" });
  assert.deepEqual(conferirPelaCompra(conf, "40093100", ["04"]), conf, "nem transforma a confirmar em sim");
});

test("PIS/COFINS no Simples só até 12/2026", () => {
  assert.equal(segregaPisCofins("2026-12"), true);
  assert.equal(segregaPisCofins("2027-01"), false);
});

test("tabela: prefixos válidos, sem repetição entre grupos e com fonte", () => {
  const vistos = new Map<string, string>();
  for (const g of GRUPOS_MONOFASICO) {
    assert.ok(g.fonte.match(/Lei|IN RFB/), `${g.id} sem lei na fonte`);
    for (const p of g.ncms) {
      assert.ok(/^\d{2,8}$/.test(p), `${g.id}: ${p}`);
      assert.ok(!vistos.has(p), `${p} em ${g.id} e ${vistos.get(p)}`);
      vistos.set(p, g.id);
    }
    for (const n of [...Object.keys(g.ex ?? {}), ...Object.keys(g.exExcluido ?? {})]) assert.ok(g.ncms.includes(n), `${g.id}: Ex de ${n} sem o NCM na lista`);
  }
});
