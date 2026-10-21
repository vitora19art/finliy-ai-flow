import { uid, type Transaction } from "@/lib/finliy";

/**
 * Empresa fictícia "Cafeteria Aurora" — dados de demonstração completos e
 * realistas: Receitas, Custos Variáveis (CMV), Despesas Operacionais,
 * Saldo de Caixa inicial, Categorias e Lançamentos Mensais.
 * Usados apenas até o primeiro lançamento/arquivo real do usuário.
 */
const rows: [string, string, string, Transaction["type"], number, string?][] = [
  // Saldo inicial de caixa
  ["2026-08-01", "Saldo inicial de caixa", "Saldo inicial", "Receita", 15000],

  // — Agosto/2026 —
  // Receitas (vendas por categoria)
  ["2026-08-03", "Venda de cafés especiais", "Vendas", "Receita", 4200, "Café"],
  ["2026-08-05", "Venda de cafés especiais", "Vendas", "Receita", 3800, "Café"],
  ["2026-08-08", "Venda de bolos e doces", "Vendas", "Receita", 2600, "Bolos"],
  ["2026-08-11", "Venda de bolos e doces", "Vendas", "Receita", 2100, "Bolos"],
  ["2026-08-15", "Venda de salgados", "Vendas", "Receita", 3100, "Salgados"],
  ["2026-08-18", "Venda de salgados", "Vendas", "Receita", 2400, "Salgados"],
  ["2026-08-22", "Venda de cafés especiais", "Vendas", "Receita", 4500, "Café"],
  ["2026-08-27", "Venda mix (cafés + doces)", "Vendas", "Receita", 5200, "Café"],

  // Custos Variáveis / CMV (matéria-prima por produto)
  ["2026-08-04", "Compra de grãos de café (fornecedor)", "Compras", "Despesa", 1800, "Café"],
  ["2026-08-09", "Compra de insumos para confeitaria", "Compras", "Despesa", 950, "Bolos"],
  ["2026-08-13", "Compra de ingredientes para salgados", "Compras", "Despesa", 1200, "Salgados"],
  ["2026-08-20", "Reposição de grãos de café", "Compras", "Despesa", 1600, "Café"],
  ["2026-08-26", "Compra de insumos para confeitaria", "Compras", "Despesa", 880, "Bolos"],

  // Despesas Operacionais
  ["2026-08-12", "Aluguel da loja", "Aluguel", "Despesa", 3000],
  ["2026-08-13", "Conta de energia elétrica", "Contas e Utilidades", "Despesa", 640],
  ["2026-08-14", "Conta de água", "Contas e Utilidades", "Despesa", 280],
  ["2026-08-17", "Internet e telefone", "Contas e Utilidades", "Despesa", 180],
  ["2026-08-25", "Folha de pagamento (baristas)", "Folha de Pagamento", "Despesa", 4500],
  ["2026-08-28", "Marketing — anúncios em redes sociais", "Marketing", "Despesa", 500],
  ["2026-08-29", "Impostos (DAS Simples Nacional)", "Impostos", "Despesa", 980],

  // — Setembro/2026 —
  // Receitas
  ["2026-09-04", "Venda de cafés especiais", "Vendas", "Receita", 4800, "Café"],
  ["2026-09-06", "Venda de cafés especiais", "Vendas", "Receita", 4600, "Café"],
  ["2026-09-12", "Venda de bolos e doces", "Vendas", "Receita", 2900, "Bolos"],
  ["2026-09-15", "Venda de salgados", "Vendas", "Receita", 3400, "Salgados"],
  ["2026-09-18", "Venda de salgados", "Vendas", "Receita", 2800, "Salgados"],
  ["2026-09-22", "Venda mix (cafés + doces)", "Vendas", "Receita", 5600, "Café"],
  ["2026-09-27", "Venda de bolos e doces", "Vendas", "Receita", 3300, "Bolos"],

  // Custos Variáveis / CMV
  ["2026-09-05", "Compra de grãos de café (fornecedor)", "Compras", "Despesa", 2000, "Café"],
  ["2026-09-10", "Compra de insumos para confeitaria", "Compras", "Despesa", 1050, "Bolos"],
  ["2026-09-14", "Compra de ingredientes para salgados", "Compras", "Despesa", 1300, "Salgados"],
  ["2026-09-21", "Reposição de grãos de café", "Compras", "Despesa", 1900, "Café"],
  ["2026-09-26", "Compra de insumos para confeitaria", "Compras", "Despesa", 920, "Bolos"],

  // Despesas Operacionais
  ["2026-09-10", "Aluguel da loja", "Aluguel", "Despesa", 3000],
  ["2026-09-11", "Conta de energia elétrica", "Contas e Utilidades", "Despesa", 690],
  ["2026-09-12", "Conta de água", "Contas e Utilidades", "Despesa", 310],
  ["2026-09-13", "Internet e telefone", "Contas e Utilidades", "Despesa", 180],
  ["2026-09-25", "Folha de pagamento (baristas)", "Folha de Pagamento", "Despesa", 4500],
  ["2026-09-14", "Marketing — anúncios em redes sociais", "Marketing", "Despesa", 500],
  ["2026-09-22", "Impostos (DAS Simples Nacional)", "Impostos", "Despesa", 1120],
];

export const demoTransactions = (): Transaction[] =>
  rows.map(([date, description, category, type, amount, product]) => ({
    id: uid(),
    date,
    description,
    category,
    type,
    amount,
    product,
  }));
