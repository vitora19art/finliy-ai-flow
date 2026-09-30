import { brl, fmtDate, type Transaction } from "./finliy";

export type CostKind = "cmv" | "aquisicao" | "operacional";

const CMV_CATS = ["Compras", "Fornecedores"];
const ACQ_CATS = ["Marketing"];

export const isOpening = (t: Transaction) => t.category === "Saldo inicial" || t.category === "-";
export const costKind = (t: Transaction): CostKind =>
  CMV_CATS.includes(t.category) ? "cmv" : ACQ_CATS.includes(t.category) ? "aquisicao" : "operacional";

const sum = (a: Transaction[]) => a.reduce((s, t) => s + t.amount, 0);
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function computeMetrics(txs: Transaction[]) {
  const revenue = txs.filter((t) => t.type === "Receita" && !isOpening(t));
  const expenses = txs.filter((t) => t.type === "Despesa");
  const cmvTx = expenses.filter((t) => costKind(t) === "cmv");
  const acqTx = expenses.filter((t) => costKind(t) === "aquisicao");
  const opTx = expenses.filter((t) => costKind(t) !== "cmv");

  const receitaBruta = sum(revenue);
  const cmv = sum(cmvTx);
  const lucroBruto = receitaBruta - cmv;
  const despesasOperacionais = sum(opTx);
  const resultadoLiquido = lucroBruto - despesasOperacionais;
  const vendasCount = revenue.length;
  const ticketMedio = vendasCount ? receitaBruta / vendasCount : 0;
  const custoAquisicao = vendasCount ? sum(acqTx) / vendasCount : 0;
  const margemBruta = receitaBruta ? (lucroBruto / receitaBruta) * 100 : 0;
  const margemLiquida = receitaBruta ? (resultadoLiquido / receitaBruta) * 100 : 0;

  // por período (dia)
  const days = [...new Set(txs.filter((t) => !isOpening(t)).map((t) => t.date))].sort();
  const porPeriodo = days.map((d) => ({
    periodo: fmtDate(d).slice(0, 5),
    Faturamento: sum(revenue.filter((t) => t.date === d)),
    Compras: sum(cmvTx.filter((t) => t.date === d)),
    Despesas: sum(expenses.filter((t) => t.date === d)),
  }));

  // saldo acumulado
  let bal = 0;
  const saldo = [...txs].sort((a, b) => a.date.localeCompare(b.date)).map((t) => {
    bal += t.type === "Receita" ? t.amount : -t.amount;
    return { periodo: fmtDate(t.date).slice(0, 5), Saldo: bal };
  });

  // despesas por categoria
  const catMap = new Map<string, number>();
  expenses.forEach((t) => catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount));
  const despesasPorCategoria = [...catMap].map(([name, value]) => ({ name, value }));

  // margem por produto
  const prodMap = new Map<string, { receita: number; custo: number }>();
  txs.filter((t) => t.product && !isOpening(t)).forEach((t) => {
    const p = prodMap.get(t.product!) ?? { receita: 0, custo: 0 };
    if (t.type === "Receita") p.receita += t.amount;
    else if (costKind(t) === "cmv") p.custo += t.amount;
    prodMap.set(t.product!, p);
  });
  const produtos = [...prodMap]
    .filter(([, v]) => v.receita > 0)
    .map(([produto, v]) => ({
      produto,
      receita: v.receita,
      custo: v.custo,
      lucro: v.receita - v.custo,
      margem: ((v.receita - v.custo) / v.receita) * 100,
    }))
    .sort((a, b) => b.margem - a.margem);

  return {
    receitaBruta, faturamentoTotal: receitaBruta, ticketMedio, vendasCount,
    totalCompras: cmv, cmv, custoAquisicao, lucroBruto, margemBruta,
    despesasOperacionais, resultadoLiquido, margemLiquida,
    porPeriodo, saldo, despesasPorCategoria, produtos,
    maiorMargem: produtos[0], menorMargem: produtos[produtos.length - 1],
    fmt: { brl, pct },
  };
}

export type Metrics = ReturnType<typeof computeMetrics>;

export function dreRows(m: Metrics): [string, number, "base" | "minus" | "result"][] {
  return [
    ["Receita Bruta", m.receitaBruta, "base"],
    ["(-) Custos Variáveis / CMV", -m.cmv, "minus"],
    ["(=) Lucro Bruto", m.lucroBruto, "result"],
    ["(-) Despesas Operacionais", -m.despesasOperacionais, "minus"],
    ["(=) Resultado Líquido", m.resultadoLiquido, "result"],
  ];
}

export function metricsRows(m: Metrics): [string, string, string][] {
  const p = m.fmt.pct;
  return [
    ["Faturamento e Receita", "Faturamento Total", brl(m.faturamentoTotal)],
    ["Faturamento e Receita", "Receita Bruta", brl(m.receitaBruta)],
    ["Faturamento e Receita", "Ticket Médio", brl(m.ticketMedio)],
    ["Faturamento e Receita", "Nº de vendas/recebimentos", String(m.vendasCount)],
    ["Compras e Custos", "Total de Compras", brl(m.totalCompras)],
    ["Compras e Custos", "CMV (Custo das Mercadorias Vendidas)", brl(m.cmv)],
    ["Compras e Custos", "Custo de Aquisição (por venda)", brl(m.custoAquisicao)],
    ["Lucro e Margens", "Lucro Bruto", brl(m.lucroBruto)],
    ["Lucro e Margens", "Margem Bruta", p(m.margemBruta)],
    ["Lucro e Margens", "Produto com maior margem", m.maiorMargem ? `${m.maiorMargem.produto} (${p(m.maiorMargem.margem)})` : "—"],
    ["Lucro e Margens", "Produto com menor margem", m.menorMargem ? `${m.menorMargem.produto} (${p(m.menorMargem.margem)})` : "—"],
  ];
}

export function aiContext(m: Metrics, txs: Transaction[]) {
  const last = txs.slice(-15).map((t) => `${fmtDate(t.date)} | ${t.description} | ${t.category} | ${t.type} | ${brl(t.amount)}`).join("\n");
  return `${metricsRows(m).map((r) => `${r[1]}: ${r[2]}`).join("\n")}
Despesas Operacionais: ${brl(m.despesasOperacionais)}
Resultado Líquido: ${brl(m.resultadoLiquido)}
Últimos lançamentos:
${last}`;
}
