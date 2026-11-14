# monofasico-br

**Is this product subject to single-stage (monophasic) PIS/COFINS? And how much did a Simples Nacional
reseller overpay?** Classification by NCM code and TIPI "Ex", with the law and article behind each decision,
built from the statutes, RFB Normative Instruction 2,121/2022 and the official SPED tables.
[Versão em português](README.md).

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

The output is in Portuguese, the language of the legislation it cites.

## What it is for

For some products, Brazilian law concentrates PIS and COFINS (federal contributions on revenue) at the
manufacturer or importer, and the reseller has a zero rate. Under Simples Nacional, the simplified regime for
small businesses where those contributions are embedded in a single monthly payment (DAS), a reseller of these
products must segregate that revenue in the PGDAS-D return and flag it as monophasic, so that PIS and COFINS
are removed from the payment (LC 123/2006, art. 18, §4-A, I; CGSN Resolution 140/2018, art. 25, §6). If the
revenue is not segregated, the business pays again a contribution already paid upstream.

The tool answers two questions:

1. **Is the item monophasic?** Three answers: **yes** (`sim`), **no** (`nao`) or **to be confirmed**
   (`confirmar`), always with the reason and the legal source. "To be confirmed" means the law requires a
   condition the NCM code alone cannot prove, or the treatment under Simples Nacional has not been confirmed by
   an official source.
2. **How much was overpaid?** An estimate of the PIS and COFINS embedded in the DAS on monophasic resale, month
   by month, over the last 60 months, with the deadline to claim a refund.

## Usage

Requires Node 20 or newer.

```bash
npm install
npm run ncm -- 30049099                         # one NCM
npm run ncm -- 84818099 --ex 01                 # with the TIPI Ex (EXTIPI field of the NF-e)
npm run ncm -- --arquivo exemplos/itens.csv     # batch: ncm;ex;cst_compra;descricao
npm run tabela                                  # the groups, with law, NCMs, exceptions and Ex
npm run recuperar -- exemplos/receitas.csv      # overpayment over the 60 months up to 2026-12
npm test
```

Options: `--json` on any command; `--ate YYYY-MM` and `--hoje YYYY-MM-DD` on `recuperar`. CSV files use
semicolons, and lines starting with `#` are comments. The files in `exemplos/` are synthetic.

## How the decision is made

1. **8-digit NCM.** Without one, "no".
2. **Longest prefix.** The table has 9 groups and 121 prefixes of 2 to 8 digits. Across all groups, the
   longest matching prefix wins, so 8431.41.00 (Annex I) beats 8431.49 (Annex II) with no special case. A test
   ensures no prefix appears in two groups.
3. **Express exceptions**, such as 3003.90.56 and 3004.90.46 in Law 10,147/2000, and 3401.11.90 under Ex 01.
4. **TIPI Ex.** Five auto-part codes are monophasic only under certain Ex. Without an Ex on the invoice, "to be
   confirmed"; with another Ex, "no". **An empty or all-zero EXTIPI ("0", "00", "000") means no Ex**: many
   issuers fill in "0", and reading it as "Ex 00" would produce a false "no".
5. **Conditions.** Annex II auto parts (only when made for machines of heading 84.29, 8433 or vehicles of 87.01
   to 87.06), biodiesel under 3824.90.29 and cold beverages stay "to be confirmed".
6. **Purchase cross-check** (`conferirPelaCompra`). If the table says "no" but the supplier sold the same NCM
   with PIS tax situation code (CST) 02, 03 or 04, the item becomes "to be confirmed". The CST never turns an
   item into "yes" on its own.

Choices worth knowing:

- **Heading 33.06 (oral hygiene) is out.** Law 12,839/2013 removed it from Law 10,147/2000. SPED table 4.3.10
  (version 37) still lists it; when the table and the law disagree, the law prevails.
- **From heading 84.31, only 8431.49 enters through Annex II.** 8431.41 and 8431.42 are already in Annex I.
  8431.43, for example, covers parts of boring and drilling machinery (8430.41 and 8430.49), which the law does
  not reach.
- **Code 2208.90.00 from table 4.3.11 (alcohol) is left out**, because the heading also covers spirits.

## How the refund estimate is computed

```text
effective rate = (RBT12 × nominal rate − deduction) / RBT12        (Annex I, commerce)
PIS + COFINS   = effective rate × (PIS % + COFINS % in the bracket's split)
overpaid       = (monophasic revenue − part already segregated in PGDAS-D) × (PIS + COFINS)
deadline       = DAS due date (20th of the following month) + 5 years
```

RBT12 is gross revenue over the previous 12 months. Brackets 1 to 5: PIS 2.76% and COFINS 12.74% of the
effective rate. Bracket 6: 6.13% and 28.27%. The window ends at 2026-12, the last period with PIS and COFINS
under Simples Nacional. Anything past its deadline on the `--hoje` date leaves the "within deadline" total.

## Limitations

- **Valid up to the 2026-12 period.** From 2027-01, PIS and COFINS give way to the new CBS and IBS under Simples
  Nacional (CGSN Resolution 190/2026), with a "monophasic IBS/CBS" this tool does not yet handle.
- **Cold beverages and Annex II stay "to be confirmed".** The law requires a condition of use the invoice
  cannot prove, or no official source confirms the PGDAS-D treatment. The accountant decides.
- **Resale only, Annex I.** Manufacturers and importers also segregate the revenue, but pay the concentrated PIS
  and COFINS separately, outside Simples Nacional. A business that imported what it resells is an importer, not
  a zero-rated reseller.
- **You provide RBT12.** The tool does not compute 12-month revenue (start of activity, proration, state
  sub-limits). Use the figure from each month's PGDAS-D.
- **It is an estimate.** The final amount is what the amended PGDAS-D returns. Amendments are allowed for 5
  years and do not reduce debts under installment plans, sent to collection or under tax audit (CGSN
  Resolution 140/2018, art. 39). Refunds are adjusted by the Selic rate.
- **The table reflects a reading on 2026-11-14.** Laws and tables change. Check the current version before
  deciding.
- This is not tax advice.

## Official sources

See the [Portuguese README](README.md#fontes-oficiais) for the full list of linked statutes, resolutions,
SPED tables, the TIPI and the Simples Nacional Q&A, all on official Brazilian government sites.

## Origin

Extracted from the tax engine of Escrituro, the accounting system I develop. There, the same rule flags each
sold item during bookkeeping, carries the flag to the PGDAS-D return and feeds a 60-month refund report. This
repository holds only the pure part: table, classification and arithmetic. Case study at
[garofalodeveloper.com](https://garofalodeveloper.com/en/cases/monofasico). Sibling repositories:
[custo-importacao-br](https://github.com/thiagogardev/custo-importacao-br) and
[icms-st-dados](https://github.com/thiagogardev/icms-st-dados).

MIT license.
