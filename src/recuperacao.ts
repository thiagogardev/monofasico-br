// Estimativa do PIS e da COFINS pagos a mais no DAS sobre a revenda de produto monofásico.
//
// Quem revende produto com PIS/COFINS concentrado tem alíquota zero: o PIS e a COFINS dessa receita
// saem do DAS (LC 123/2006, art. 18, §4º-A, I; Res. CGSN 140/2018, art. 25, §§ 6º e 7º). Quem não
// segregou pagou em dobro: o fabricante ou o importador já recolheu a contribuição concentrada.
//
// Conta (Anexo I, comércio; LC 123/2006 na redação da LC 155/2016, vigente de 01/2018 a 12/2026):
//   alíquota efetiva = (RBT12 × alíquota nominal − parcela a deduzir) / RBT12
//   PIS + COFINS     = alíquota efetiva × (percentual do PIS + percentual da COFINS na faixa)
//   pago a mais      = (receita monofásica − parte já segregada) × (PIS + COFINS)
//   prazo            = vencimento do DAS (dia 20 do mês seguinte) + 5 anos

import { FIM_PIS_COFINS_MONOFASICO } from "./tabela.ts";

type Faixa = { ateCent: number; nominal: number; deduzirCent: number; pis: number; cofins: number };

const R = (reais: number) => Math.round(reais * 100);

/** Anexo I da LC 123/2006 (comércio): faixas de RBT12, alíquota nominal, parcela a deduzir e partilha de PIS e COFINS. */
export const ANEXO_I: Faixa[] = [
  { ateCent: R(180_000), nominal: 0.04, deduzirCent: 0, pis: 0.0276, cofins: 0.1274 },
  { ateCent: R(360_000), nominal: 0.073, deduzirCent: R(5_940), pis: 0.0276, cofins: 0.1274 },
  { ateCent: R(720_000), nominal: 0.095, deduzirCent: R(13_860), pis: 0.0276, cofins: 0.1274 },
  { ateCent: R(1_800_000), nominal: 0.107, deduzirCent: R(22_500), pis: 0.0276, cofins: 0.1274 },
  { ateCent: R(3_600_000), nominal: 0.143, deduzirCent: R(87_300), pis: 0.0276, cofins: 0.1274 },
  { ateCent: R(4_800_000), nominal: 0.19, deduzirCent: R(378_000), pis: 0.0613, cofins: 0.2827 },
];

export const MESES_RECUPERACAO = 60;

/** Faixa (1 a 6) do Anexo I para a receita bruta dos 12 meses anteriores, em centavos. */
export function faixaAnexoI(rbt12Cent: number): { numero: number; faixa: Faixa } {
  const i = ANEXO_I.findIndex((f) => rbt12Cent <= f.ateCent);
  const numero = i === -1 ? ANEXO_I.length : i + 1;
  return { numero, faixa: ANEXO_I[numero - 1] };
}

/** Alíquota efetiva do Anexo I (fração). Sem RBT12 (início de atividade), vale a nominal da 1ª faixa. */
export function aliquotaEfetiva(rbt12Cent: number): number {
  const { faixa } = faixaAnexoI(rbt12Cent);
  if (rbt12Cent <= 0) return faixa.nominal;
  return Math.max(0, (rbt12Cent * faixa.nominal - faixa.deduzirCent) / rbt12Cent);
}

/** PIS + COFINS efetivos da revenda (fração da receita) no Anexo I. */
export function pisCofinsRevenda(rbt12Cent: number): number {
  const { faixa } = faixaAnexoI(rbt12Cent);
  return aliquotaEfetiva(rbt12Cent) * (faixa.pis + faixa.cofins);
}

/** Último dia para pedir a restituição: vencimento do DAS (dia 20 do mês seguinte) + 5 anos, sem ajuste de dia útil. */
export function prazoRestituicao(competencia: string): string {
  const [a, m] = competencia.split("-").map(Number);
  const ano = m === 12 ? a + 1 : a;
  const mes = m === 12 ? 1 : m + 1;
  return `${ano + 5}-${String(mes).padStart(2, "0")}-20`;
}

/** As `n` competências anteriores a `competencia` e ela mesma, em ordem ("AAAA-MM"). */
export function janela(competencia: string, n: number): string[] {
  const [a, m] = competencia.split("-").map(Number);
  const out: string[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const t = a * 12 + (m - 1) - k;
    out.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}

export type MesReceita = {
  competencia: string; // "AAAA-MM"
  rbt12Cent: number; // receita bruta dos 12 meses anteriores
  receitaMonofasicaCent: number; // revenda de produto monofásico no mês
  jaSegregadaCent?: number; // parte que o PGDAS-D do mês já declarou como monofásica
};

export type LinhaRecuperacao = {
  competencia: string;
  faixa: number;
  pisCofins: number; // fração
  baseCent: number;
  pagoAMaisCent: number;
  prazoAte: string;
  situacao: "no_prazo" | "vencido";
};

/**
 * Pago a mais por mês, nos 60 meses até `ate` (no máximo 12/2026). Meses fora da janela são ignorados.
 * `hoje` ("AAAA-MM-DD") separa o que ainda pode ser pedido do que já prescreveu.
 */
export function estimarRecuperacao(meses: MesReceita[], ate: string, hoje: string): { linhas: LinhaRecuperacao[]; noPrazoCent: number; vencidoCent: number } {
  const fim = ate > FIM_PIS_COFINS_MONOFASICO ? FIM_PIS_COFINS_MONOFASICO : ate;
  const dentro = new Set(janela(fim, MESES_RECUPERACAO));
  const linhas: LinhaRecuperacao[] = [];
  for (const m of [...meses].sort((x, y) => x.competencia.localeCompare(y.competencia))) {
    if (!dentro.has(m.competencia)) continue;
    const pisCofins = pisCofinsRevenda(m.rbt12Cent);
    const baseCent = Math.max(0, m.receitaMonofasicaCent - (m.jaSegregadaCent ?? 0));
    const prazoAte = prazoRestituicao(m.competencia);
    linhas.push({
      competencia: m.competencia,
      faixa: faixaAnexoI(m.rbt12Cent).numero,
      pisCofins,
      baseCent,
      pagoAMaisCent: Math.round(baseCent * pisCofins),
      prazoAte,
      situacao: hoje <= prazoAte ? "no_prazo" : "vencido",
    });
  }
  const soma = (s: LinhaRecuperacao["situacao"]) => linhas.filter((l) => l.situacao === s).reduce((t, l) => t + l.pagoAMaisCent, 0);
  return { linhas, noPrazoCent: soma("no_prazo"), vencidoCent: soma("vencido") };
}
