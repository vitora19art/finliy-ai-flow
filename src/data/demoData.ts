import { uid, type Transaction } from "@/lib/finliy";

/** Empresa fictícia usada apenas até o primeiro lançamento/arquivo real. */
const rows: [string, string, string, Transaction["type"], number, string?][] = [
  ["2026-08-01", "Saldo inicial do mês", "Saldo inicial", "Receita", 15000],
  ["2026-08-03", "Venda de cafés especiais", "Vendas", "Receita", 4200, "Café"],
  ["2026-08-05", "Compra de grãos do fornecedor", "Compras", "Despesa", 1800, "Café"],
  ["2026-08-08", "Venda de bolos e doces", "Vendas", "Receita", 2600, "Bolos"],
  ["2026-08-10", "Compra de insumos para confeitaria", "Compras", "Despesa", 950, "Bolos"],
  ["2026-08-12", "Aluguel da loja", "Aluguel", "Despesa", 3000],
  ["2026-08-15", "Venda de salgados", "Vendas", "Receita", 3100, "Salgados"],
  ["2026-08-16", "Compra de ingredientes para salgados", "Compras", "Despesa", 1200, "Salgados"],
  ["2026-08-20", "Conta de energia", "Contas e Utilidades", "Despesa", 640],
  ["2026-08-25", "Folha de pagamento", "Folha de Pagamento", "Despesa", 4500],
  ["2026-09-04", "Venda de cafés especiais", "Vendas", "Receita", 4800, "Café"],
  ["2026-09-06", "Compra de grãos do fornecedor", "Compras", "Despesa", 2000, "Café"],
  ["2026-09-12", "Venda de bolos e doces", "Vendas", "Receita", 2900, "Bolos"],
  ["2026-09-14", "Anúncios em redes sociais", "Marketing", "Despesa", 500],
  ["2026-09-18", "Venda de salgados", "Vendas", "Receita", 3400, "Salgados"],
  ["2026-09-22", "Impostos (DAS)", "Impostos", "Despesa", 980],
];

export const demoTransactions = (): Transaction[] =>
  rows.map(([date, description, category, type, amount, product]) => ({ id: uid(), date, description, category, type, amount, product }));
