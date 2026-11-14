// CLI do monofasico-br.
//
//   npm run ncm -- 84818099 --ex 01              classifica um ou mais NCMs
//   npm run ncm -- --arquivo exemplos/itens.csv   classifica um CSV (ncm;ex;cst_compra;descricao)
//   npm run tabela                                lista os grupos com a fonte legal
//   npm run recuperar -- exemplos/receitas.csv    estima o PIS/COFINS pago a mais (60 meses)
//
// Opções: --json (saída em JSON), --ate AAAA-MM e --hoje AAAA-MM-DD (recuperar).

import fs from "node:fs";
import { classificar, conferirPelaCompra, type Classificacao } from "./classificar.ts";
import { estimarRecuperacao, MESES_RECUPERACAO, type MesReceita } from "./recuperacao.ts";
import { FIM_PIS_COFINS_MONOFASICO, GRUPOS_MONOFASICO } from "./tabela.ts";

const args = process.argv.slice(2);
const opcao = (nome: string) => {
  const i = args.indexOf(`--${nome}`);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const flag = (nome: string) => {
  const i = args.indexOf(`--${nome}`);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};

const ROTULO: Record<Classificacao["situacao"], string> = { sim: "SIM", confirmar: "A CONFIRMAR", nao: "NÃO" };
const ncmFmt = (n: string) => (n.length === 8 ? `${n.slice(0, 4)}.${n.slice(4, 6)}.${n.slice(6)}` : n);
const brl = (cent: number) => (cent / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%`;
const reaisParaCent = (s: string) => Math.round(Number((s ?? "").trim().replace(/\./g, "").replace(",", ".")) * 100);

function lerCsv(caminho: string): Array<Record<string, string>> {
  const linhas = fs.readFileSync(caminho, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
  const cab = linhas.shift()!.split(";").map((c) => c.trim().toLowerCase());
  return linhas.map((l) => Object.fromEntries(l.split(";").map((v, i) => [cab[i], v.trim()])));
}

function comandoNcm() {
  const json = flag("json");
  const arquivo = opcao("arquivo");
  const ex = opcao("ex");
  const itens = arquivo
    ? lerCsv(arquivo).map((r) => ({ ncm: r.ncm, ex: r.ex, cst: r.cst_compra ? [r.cst_compra] : [], descricao: r.descricao ?? "" }))
    : args.map((ncm) => ({ ncm, ex, cst: [] as string[], descricao: "" }));
  if (!itens.length) {
    console.error("Informe um NCM (npm run ncm -- 40111000) ou --arquivo itens.csv");
    process.exit(1);
  }
  const resultado = itens.map((i) => ({ ...i, ...conferirPelaCompra(classificar(i), i.ncm, i.cst) }));
  if (json) return console.log(JSON.stringify(resultado, null, 2));
  for (const r of resultado) {
    const ncm = r.ncm.replace(/\D/g, "");
    const exTxt = r.ex && !/^0*$/.test(r.ex) ? ` Ex ${r.ex}` : "";
    console.log(`${ncmFmt(ncm)}${exTxt}  ${ROTULO[r.situacao]}${r.nome ? `  (${r.nome})` : ""}${r.descricao ? `  ${r.descricao}` : ""}`);
    console.log(`  ${r.motivo}`);
    if (r.fonte && r.situacao !== "sim") console.log(`  Fonte: ${r.fonte}`);
  }
  const conta = (s: Classificacao["situacao"]) => resultado.filter((r) => r.situacao === s).length;
  if (resultado.length > 1) console.log(`\n${resultado.length} itens: ${conta("sim")} sim, ${conta("confirmar")} a confirmar, ${conta("nao")} não.`);
}

function comandoTabela() {
  if (flag("json")) return console.log(JSON.stringify(GRUPOS_MONOFASICO, null, 2));
  for (const g of GRUPOS_MONOFASICO) {
    console.log(`${g.nome}${g.condicao ? "  [a confirmar]" : ""}`);
    console.log(`  Fonte: ${g.fonte}`);
    console.log(`  NCM: ${g.ncms.join(", ")}`);
    if (g.excecoes) console.log(`  Exceções: ${g.excecoes.join(", ")}`);
    if (g.ex) console.log(`  Só nos Ex: ${Object.entries(g.ex).map(([n, e]) => `${n} (${e.join(", ")})`).join("; ")}`);
    if (g.exExcluido) console.log(`  Fora nos Ex: ${Object.entries(g.exExcluido).map(([n, e]) => `${n} (${e.join(", ")})`).join("; ")}`);
    console.log("");
  }
}

function comandoRecuperar() {
  const json = flag("json");
  const ate = opcao("ate") ?? FIM_PIS_COFINS_MONOFASICO;
  const hoje = opcao("hoje") ?? new Date().toISOString().slice(0, 10);
  const arquivo = args[0];
  if (!arquivo) {
    console.error("Informe o CSV: npm run recuperar -- exemplos/receitas.csv");
    process.exit(1);
  }
  const meses: MesReceita[] = lerCsv(arquivo).map((r) => ({
    competencia: r.competencia,
    rbt12Cent: reaisParaCent(r.rbt12),
    receitaMonofasicaCent: reaisParaCent(r.receita_monofasica),
    jaSegregadaCent: r.ja_segregada ? reaisParaCent(r.ja_segregada) : 0,
  }));
  const r = estimarRecuperacao(meses, ate, hoje);
  if (json) return console.log(JSON.stringify(r, null, 2));
  console.log(`PIS e COFINS pagos a mais na revenda de monofásico (Anexo I), ${MESES_RECUPERACAO} meses até ${ate > FIM_PIS_COFINS_MONOFASICO ? FIM_PIS_COFINS_MONOFASICO : ate}, posição em ${hoje}\n`);
  console.log("Mês      Faixa  PIS+COFINS   Base            Pago a mais     Pedir até");
  for (const l of r.linhas)
    console.log(
      `${l.competencia}  ${String(l.faixa).padStart(5)}  ${pct(l.pisCofins).padStart(10)}  ${brl(l.baseCent).padStart(14)}  ${brl(l.pagoAMaisCent).padStart(14)}  ${l.prazoAte}${l.situacao === "vencido" ? "  vencido" : ""}`,
    );
  console.log(`\nNo prazo: ${brl(r.noPrazoCent)}   Vencido: ${brl(r.vencidoCent)}`);
  console.log("Estimativa. O valor final é o que o PGDAS-D retificado devolver.");
}

const comando = args.shift();
if (comando === "ncm") comandoNcm();
else if (comando === "tabela") comandoTabela();
else if (comando === "recuperar") comandoRecuperar();
else {
  console.error("Comandos: ncm, tabela, recuperar");
  process.exit(1);
}
