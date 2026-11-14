import { CST_PIS_MONOFASICO, FIM_PIS_COFINS_MONOFASICO, GRUPOS_MONOFASICO, type Grupo } from "./tabela.ts";

export type Situacao = "sim" | "confirmar" | "nao";

export type Classificacao = {
  situacao: Situacao;
  grupo: string | null;
  nome: string | null;
  fonte: string | null;
  motivo: string;
};

const so = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * Ex da TIPI informado na nota (campo EXTIPI), com dois dígitos. Vazio ou só zeros ("0", "00", "000")
 * quer dizer que o produto não tem Ex: devolve null.
 */
export function exInformado(s: string | null | undefined): string | null {
  const d = so(s);
  if (/^0*$/.test(d)) return null;
  return d.padStart(2, "0").slice(-2);
}

/** Decide pela tabela se o item (NCM e, se houver, o Ex da TIPI) é de produto com PIS/COFINS concentrado. */
export function classificar(i: { ncm: string | null | undefined; ex?: string | null }): Classificacao {
  const ncm = so(i.ncm);
  const nao = (motivo: string): Classificacao => ({ situacao: "nao", grupo: null, nome: null, fonte: null, motivo });
  if (ncm.length !== 8) return nao("item sem NCM de 8 dígitos");

  // Regra do maior prefixo: entre todos os grupos, vence o prefixo mais longo que casar com o NCM.
  let melhor: { g: Grupo; p: string } | null = null;
  for (const g of GRUPOS_MONOFASICO)
    for (const p of g.ncms) if (ncm.startsWith(p) && (!melhor || p.length > melhor.p.length)) melhor = { g, p };
  if (!melhor) return nao("NCM fora da lista de produtos com PIS/COFINS concentrado");

  const { g, p } = melhor;
  const base = { grupo: g.id, nome: g.nome, fonte: g.fonte };
  if (g.excecoes?.some((x) => ncm.startsWith(x))) return { situacao: "nao", ...base, motivo: `NCM ${ncm} é exceção expressa do grupo ${g.nome}` };

  const ex = exInformado(i.ex);
  const excluido = g.exExcluido?.[p];
  if (excluido && ex && excluido.includes(ex)) return { situacao: "nao", ...base, motivo: `NCM ${ncm} Ex ${ex} é exceção expressa do grupo ${g.nome}` };

  const exigidos = g.ex?.[p];
  if (exigidos) {
    if (!ex) return { situacao: "confirmar", ...base, motivo: `o NCM ${ncm} só é monofásico no Ex ${exigidos.join(" ou ")} da TIPI, e a nota não informa o Ex` };
    if (!exigidos.includes(ex)) return { situacao: "nao", ...base, motivo: `o NCM ${ncm} só é monofásico no Ex ${exigidos.join(" ou ")} da TIPI; a nota informa o Ex ${ex}` };
  }
  if (g.condicao) return { situacao: "confirmar", ...base, motivo: g.condicao };
  return { situacao: "sim", ...base, motivo: `${g.nome}: ${g.fonte}` };
}

/**
 * Conferência pela compra. A tabela manda; o CST de PIS da nota do fornecedor só serve de alerta. Se a
 * tabela disse "não", mas o fornecedor vendeu o mesmo NCM com CST 02, 03 ou 04, o item fica "a confirmar"
 * para uma pessoa decidir. O CST nunca transforma um item em "sim" sozinho.
 */
export function conferirPelaCompra(c: Classificacao, ncm: string, cstsDaCompra: Array<string | null | undefined>): Classificacao {
  if (c.situacao !== "nao" || so(ncm).length !== 8) return c;
  const cst = cstsDaCompra.map((x) => so(x).padStart(2, "0")).find((x) => CST_PIS_MONOFASICO.includes(x));
  if (!cst) return c;
  return {
    ...c,
    situacao: "confirmar",
    motivo: `o fornecedor vendeu o NCM ${so(ncm)} com CST de PIS ${cst} (monofásico), mas o NCM não está na tabela oficial; confira o produto`,
  };
}

/** A segregação de PIS/COFINS no Simples só existe até a competência 12/2026 (depois, CBS e IBS). */
export const segregaPisCofins = (competencia: string) => competencia <= FIM_PIS_COFINS_MONOFASICO;
