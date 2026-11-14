# monofasico-br

[![testes](https://github.com/thiagogardev/monofasico-br/actions/workflows/testes.yml/badge.svg)](https://github.com/thiagogardev/monofasico-br/actions/workflows/testes.yml)

**Este produto é monofásico de PIS/COFINS? E quanto o Simples Nacional pagou a mais na revenda?**
Classificação por NCM e Ex da TIPI com a lei e o artigo de cada decisão, a partir das leis, da IN RFB
nº 2.121/2022 e das tabelas oficiais do SPED. [English version](README.en.md).

```text
$ npm run ncm -- 40111000 84818099 40093100 --ex 0

4011.10.00  SIM  (Pneus novos e câmaras de ar)
  Pneus novos e câmaras de ar: Lei 10.485/2002, art. 5º; tabela SPED 4.3.10, código 304
8481.80.99  A CONFIRMAR  (Autopeças (Anexo I))
  o NCM 84818099 só é monofásico no Ex 01 ou 02 da TIPI, e a nota não informa o Ex
  Fonte: Lei 10.485/2002, art. 3º e Anexo I; IN RFB 2.121/2022, Anexo I (códigos da TIPI atual)
4009.31.00  A CONFIRMAR  (Autopeças (Anexo II, com condição de uso))
  a lei só alcança o item próprio para máquinas e veículos autopropulsados das posições 84.29, ...
  Fonte: Lei 10.485/2002, art. 3º e Anexo II; IN RFB 2.121/2022, Anexo II

3 itens: 1 sim, 2 a confirmar, 0 não.
```

## Para que serve

Em alguns produtos a lei concentra o PIS e a COFINS no fabricante ou no importador, e o revendedor tem
alíquota zero. No Simples Nacional, quem revende esses produtos precisa separar a receita no PGDAS-D e
marcá-la como monofásica, para que o PIS e a COFINS saiam do DAS (LC 123/2006, art. 18, §4º-A, I; Res. CGSN
140/2018, art. 25, §6º). Quando não separa, paga de novo uma contribuição que já foi paga na cadeia.

A ferramenta responde duas perguntas:

1. **O item é monofásico?** Três respostas: **sim**, **não** ou **a confirmar**, sempre com o motivo e a
   fonte legal. "A confirmar" é quando a lei exige uma condição que o NCM sozinho não prova, ou quando o
   tratamento no Simples não foi confirmado em fonte oficial.
2. **Quanto foi pago a mais?** Estimativa do PIS e da COFINS embutidos no DAS sobre a revenda de monofásico,
   mês a mês, nos últimos 60 meses, com o prazo para pedir a restituição.

## Uso

Requer Node 20 ou mais novo.

```bash
npm install
npm run ncm -- 30049099                         # um NCM
npm run ncm -- 84818099 --ex 01                 # com o Ex da TIPI (campo EXTIPI da NF-e)
npm run ncm -- --arquivo exemplos/itens.csv     # lote: ncm;ex;cst_compra;descricao
npm run tabela                                  # os grupos, com lei, NCMs, exceções e Ex
npm run recuperar -- exemplos/receitas.csv      # pago a mais nos 60 meses até 12/2026
npm test
```

Opções: `--json` em qualquer comando; `--ate AAAA-MM` e `--hoje AAAA-MM-DD` no `recuperar`. Os CSVs usam
ponto e vírgula, e linhas começando com `#` são comentários. Os exemplos em `exemplos/` são sintéticos.

Como biblioteca:

```ts
import { classificar, conferirPelaCompra, estimarRecuperacao } from "./src/index.ts";

const c = classificar({ ncm: "8481.80.99", ex: "01" }); // { situacao: "sim", grupo, nome, fonte, motivo }
conferirPelaCompra(classificar({ ncm: "39269090" }), "39269090", ["04"]); // "a confirmar"
```

## Como a decisão é tomada

1. **NCM de 8 dígitos.** Sem ele, "não".
2. **Maior prefixo.** A tabela tem 9 grupos e 121 prefixos de 2 a 8 dígitos. Entre todos os grupos, vence o
   prefixo mais longo que casar com o NCM. Assim o 8431.41.00 (Anexo I) vence a 8431.49 (Anexo II) sem caso
   especial. Um teste garante que nenhum prefixo aparece em dois grupos.
3. **Exceções expressas.** Por exemplo, 3003.90.56 e 3004.90.46 na Lei 10.147/2000, e o 3401.11.90 no Ex 01.
4. **Ex da TIPI.** Cinco NCMs das autopeças só são monofásicos em certos Ex. Sem Ex na nota, "a confirmar";
   com outro Ex, "não". **EXTIPI vazio ou só zeros ("0", "00", "000") quer dizer sem Ex**: vários emissores
   preenchem "0", e ler isso como "Ex 00" daria um falso "não".
5. **Condições.** Anexo II das autopeças (item próprio para máquinas da 84.29, 8433 ou veículos da 87.01 a
   87.06), biodiesel no 3824.90.29 e bebidas frias ficam "a confirmar".
6. **Conferência pela compra** (`conferirPelaCompra`). Se a tabela disse "não" e o fornecedor vendeu o mesmo
   NCM com CST de PIS 02, 03 ou 04, o item vira "a confirmar". O CST nunca transforma um item em "sim".

Escolhas que vale conhecer:

- **A posição 33.06 (higiene bucal) está fora.** Saiu da Lei 10.147/2000 com a Lei 12.839/2013. A tabela
  4.3.10 do SPED (versão 37) ainda a lista; quando a tabela e a lei divergem, vale a lei.
- **Da 84.31, só a 8431.49 entra pelo Anexo II.** A 8431.41 e a 8431.42 já estão no Anexo I. A 8431.43, por
  exemplo, é parte de máquina de sondagem e perfuração (8430.41 e 8430.49), que a lei não alcança.
- **O 2208.90.00 da tabela 4.3.11 (álcool) fica de fora**, porque a posição também abrange bebidas destiladas.

## Como a recuperação é calculada

```text
alíquota efetiva = (RBT12 × alíquota nominal − parcela a deduzir) / RBT12      (Anexo I, comércio)
PIS + COFINS     = alíquota efetiva × (% do PIS + % da COFINS na partilha da faixa)
pago a mais      = (receita monofásica − parte já segregada no PGDAS-D) × (PIS + COFINS)
prazo            = vencimento do DAS (dia 20 do mês seguinte) + 5 anos
```

Faixas 1 a 5: PIS 2,76% e COFINS 12,74% da alíquota efetiva. Faixa 6: 6,13% e 28,27%. A janela vai até
12/2026, a última competência com PIS e COFINS no Simples. O que passou do prazo na data de `--hoje` sai do
total "no prazo".

## Limites

- **Vale até a competência 12/2026.** A partir de 01/2027 o PIS e a COFINS dão lugar à CBS e ao IBS no Simples
  (Res. CGSN 190/2026), com uma "IBS/CBS monofásica" que esta ferramenta ainda não trata.
- **Bebidas frias e Anexo II ficam "a confirmar".** A lei exige uma condição de uso que a nota não prova, ou
  a fonte oficial não confirma o tratamento no PGDAS-D. Quem decide é o contador.
- **Revenda apenas, no Anexo I.** O fabricante e o importador também separam a receita, mas pagam o PIS e a
  COFINS concentrados por DARF, fora do Simples. Empresa que importou o que revende é importadora, não
  revendedora com alíquota zero.
- **A RBT12 é sua.** A ferramenta não calcula a receita dos 12 meses (início de atividade, proporcionalização,
  sublimite). Use a do PGDAS-D de cada mês.
- **É estimativa.** O valor final é o que o PGDAS-D retificado devolver. A retificação vale por 5 anos e não
  reduz débito parcelado, enviado à PGFN ou sob procedimento fiscal (Res. CGSN 140/2018, art. 39). A
  restituição é corrigida pela Selic.
- **A tabela é uma leitura de 14/11/2026.** Leis e tabelas mudam. Confira a versão vigente antes de decidir.
- Não é consultoria tributária.

## Fontes oficiais

- [LC 123/2006](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm), art. 18, §4º-A, I, §§ 12 e 13, e Anexo I
- [Resolução CGSN 140/2018](http://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278), art. 5º, X, art. 25, §§ 6º e 7º, art. 39 e arts. 128 a 132
- [Resolução CGSN 190/2026](http://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=152832) (regra de 01/01/2027)
- [Lei 9.718/1998](https://www.planalto.gov.br/ccivil_03/leis/l9718compilada.htm), arts. 4º e 5º (combustíveis)
- [Lei 10.147/2000](https://www.planalto.gov.br/ccivil_03/leis/l10147.htm), art. 1º (farmacêuticos e perfumaria)
- [Lei 10.485/2002](https://www.planalto.gov.br/ccivil_03/leis/2002/l10485compilado.htm), arts. 1º, 3º e 5º e Anexos I e II (veículos, autopeças, pneus)
- [Lei 10.560/2002](https://www.planalto.gov.br/ccivil_03/leis/2002/L10560compilado.htm), art. 2º (querosene de aviação)
- [Lei 11.116/2005](https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11116.htm) (biodiesel)
- [Lei 12.839/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12839.htm) (tirou a 33.06 da Lei 10.147)
- [Lei 13.097/2015](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13097.htm), arts. 14, 25 e 28 (bebidas frias)
- [IN RFB 2.121/2022](http://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=127905), Anexos I e II (autopeças pela TIPI atual)
- [Tabelas 4.3.10 e 4.3.11 da EFD-Contribuições](http://sped.rfb.gov.br/pasta/show/1616) (SPED)
- [TIPI](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/legislacao/documentos-e-arquivos/tipi.xlsx/view) (Receita Federal)
- [Perguntas e respostas do Simples Nacional](https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/PerguntaoSN.pdf), itens 7.3, 7.4 e 10.1 a 10.9

As páginas de normas da Receita abrem só no navegador (são montadas por JavaScript).

## Origem

Extraído do motor tributário do Escrituro, o sistema contábil que desenvolvo. Lá, a mesma regra marca cada
item vendido na escrituração, leva a marca ao PGDAS-D e alimenta um relatório de recuperação de 60 meses.
Aqui está só a parte pura: tabela, classificação e conta. Case em
[garofalodeveloper.com](https://garofalodeveloper.com/cases/monofasico). Repositórios irmãos:
[custo-importacao-br](https://github.com/thiagogardev/custo-importacao-br) e
[icms-st-dados](https://github.com/thiagogardev/icms-st-dados).

Licença MIT.
