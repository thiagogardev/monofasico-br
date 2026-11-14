// Tabela de produtos com PIS/COFINS monofásico (tributação concentrada), para o Simples Nacional.
//
// A lista vem das leis (o NCM está no texto da lei) e das tabelas oficiais do SPED: EFD-Contribuições
// 4.3.10 (versão 37) e 4.3.11 (versão 41), lidas em 14/11/2026. Quando as duas divergem, vale a lei.
// Onde a lei exige uma condição de uso que o NCM sozinho não prova (Anexo II das autopeças) ou onde o
// tratamento no Simples não foi confirmado em fonte oficial (bebidas frias), o item fica "a confirmar".

export type Grupo = {
  id: string;
  nome: string;
  /** Lei, artigo e tabela oficial que sustentam o grupo. */
  fonte: string;
  /** Prefixos de NCM (só dígitos, de 2 a 8). O mais longo que casar decide entre os grupos. */
  ncms: string[];
  /** Prefixos excluídos expressamente pela lei. */
  excecoes?: string[];
  /** NCM que só é monofásico em certos "Ex" da TIPI (campo EXTIPI da NF-e). */
  ex?: Record<string, string[]>;
  /** NCM excluído só num "Ex". */
  exExcluido?: Record<string, string[]>;
  /** Condição legal que o NCM sozinho não prova: o item fica "a confirmar". */
  condicao?: string;
};

export const CONDICAO_ANEXO_II =
  "próprio para máquinas e veículos autopropulsados das posições 84.29, 8433.20, 8433.30.00, 8433.40.00, 8433.5 e 87.01 a 8706.00";

export const GRUPOS_MONOFASICO: Grupo[] = [
  {
    id: "combustiveis",
    nome: "Combustíveis",
    fonte: "Lei 9.718/1998, arts. 4º e 5º; Lei 10.560/2002, art. 2º; tabelas SPED 4.3.10 e 4.3.11 (códigos 101 a 117)",
    // Gasolinas, diesel, GLP, querosene de aviação, biodiesel e etanol. O 2208.90.00 da tabela 4.3.11
    // (álcool) fica de fora de propósito: a posição também abrange bebidas destiladas.
    ncms: ["27101159", "27101259", "27101921", "27111910", "27101911", "38260000", "220710", "2207201"],
  },
  {
    id: "biodiesel_3824",
    nome: "Biodiesel (3824.90.29)",
    fonte: "Lei 11.116/2005; tabela SPED 4.3.10, códigos 109 a 111",
    ncms: ["38249029"],
    condicao: "só quando o produto é biodiesel; o código 3824.90.29 abrange outras preparações químicas",
  },
  {
    id: "farmaceuticos",
    nome: "Produtos farmacêuticos",
    fonte: "Lei 10.147/2000, art. 1º, I, a; tabela SPED 4.3.10, código 201",
    ncms: ["3001", "3003", "3004", "3002101", "3002102", "3002103", "3002201", "3002202", "3006301", "3006302", "30029020", "30029092", "30029099", "30051010", "30066000"],
    excecoes: ["30039056", "30049046"],
  },
  {
    id: "perfumaria",
    nome: "Perfumaria, toucador e higiene pessoal",
    // A 33.06 (higiene bucal) saiu da lista com a MP 609/2013, convertida na Lei 12.839/2013. A tabela
    // SPED 4.3.10 v37 (código 202) ainda a lista, mas vale a lei.
    fonte: "Lei 10.147/2000, art. 1º, I, b (redação da Lei 12.839/2013)",
    ncms: ["3303", "3304", "3305", "3307", "34011190", "34012010", "96032100"],
    exExcluido: { "34011190": ["01"] },
  },
  {
    id: "veiculos",
    nome: "Veículos e máquinas",
    fonte: "Lei 10.485/2002, art. 1º; tabela SPED 4.3.10, código 301",
    ncms: ["7309", "731029", "76129012", "842481", "8429", "84324000", "84328000", "843320", "84333000", "84334000", "84335", "8701", "8702", "8703", "8704", "8705", "8706", "87162000"],
  },
  {
    id: "autopecas_anexo_i",
    nome: "Autopeças (Anexo I)",
    fonte: "Lei 10.485/2002, art. 3º e Anexo I; IN RFB 2.121/2022, Anexo I (códigos da TIPI atual)",
    ncms: [
      "40161010", "40169100", "6813", "70071100", "70072100", "70091000", "73201000", "83012000", "83023000", "84073390", "84073490", "840820", "840991", "840999",
      "841330", "84139190", "84148021", "84148022", "841520", "84212300", "84213100", "84314100", "84314200", "84339090", "84818099", "848310", "84832000", "848330",
      "848340", "848350", "850520", "850710", "8511", "851220", "85123000", "851240", "85129000", "85272", "85365090", "853910", "85443000", "870600", "8707", "8708",
      "90292010", "90299010", "90303321", "90318040", "9032892", "91040000", "94012000",
    ],
    ex: { "40169100": ["01", "02"], "73201000": ["01"], "84139190": ["01"], "84818099": ["01", "02"], "85365090": ["01"] },
  },
  {
    id: "autopecas_anexo_ii",
    nome: "Autopeças (Anexo II, com condição de uso)",
    fonte: "Lei 10.485/2002, art. 3º e Anexo II; IN RFB 2.121/2022, Anexo II",
    ncms: ["4009", "843149", "84089090", "84122110", "84122190", "84123110", "84136019", "84148019", "84149039", "84329000", "84811000", "84812090", "84818092", "8483601", "85011019"],
    // 84.31: só a 8431.49 (partes das máquinas das posições 84.26, 84.29 e 84.30) pode ser parte de
    // máquina da 84.29 (item 2 do Anexo II). A 8431.41 e a 8431.42 já estão no Anexo I. Da 8431.10 à
    // 8431.39 e a 8431.43 são partes de outras máquinas (84.25, 84.27, 84.28 e as de sondagem e
    // perfuração da 8430.41 e 8430.49): não entram.
    condicao: `a lei só alcança o item ${CONDICAO_ANEXO_II} (40.09: tubo de borracha com acessórios; 8431.49: partes reconhecíveis como de máquinas da 84.29; os demais códigos com a condição do item do Anexo II)`,
  },
  {
    id: "pneus",
    nome: "Pneus novos e câmaras de ar",
    fonte: "Lei 10.485/2002, art. 5º; tabela SPED 4.3.10, código 304",
    ncms: ["4011", "4013"],
  },
  {
    id: "bebidas_frias",
    nome: "Bebidas frias (águas, refrigerantes, cervejas)",
    fonte: "Lei 13.097/2015, arts. 14, 25 e 28",
    ncms: ["2201", "2202", "2203", "21069010"],
    condicao: "o tratamento da revenda de bebidas frias como monofásica no PGDAS-D não foi confirmado em fonte oficial; confira com o contador antes de marcar",
  },
];

/** Última competência com PIS/COFINS no Simples. Em 2027 entram a CBS e o IBS (Res. CGSN 190/2026). */
export const FIM_PIS_COFINS_MONOFASICO = "2026-12";

/** CST de PIS/COFINS de produto monofásico na nota do fornecedor (tabela de CST do SPED). */
export const CST_PIS_MONOFASICO = ["02", "03", "04"];
