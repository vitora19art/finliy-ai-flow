import { describe, expect, test } from "bun:test";
import { isCalculationRequest, transactionFromMessage, type Transaction } from "./finliy";
import { computeMetrics } from "./metrics";
import { importTransactionsFromXlsx } from "./importXlsx";

describe("FINLIY financial rules", () => {
  test("comprei 300 em estoque becomes a purchase and adds 300 to costs", () => {
    const tx = transactionFromMessage("comprei 300 em estoque");
    expect(tx?.amount).toBe(300);
    expect(tx?.category).toBe("Compras");
    expect(tx?.type).toBe("Despesa");
    const m = computeMetrics(tx ? [tx] : []);
    expect(m.totalCompras).toBe(300);
    expect(m.cmv).toBe(300);
  });
  test("10% hypothetical sales increase never becomes a transaction", () => {
    const input = "Se eu vender 10% a mais, qual o impacto no faturamento?";
    expect(transactionFromMessage(input)).toBeNull();
    expect(isCalculationRequest(input)).toBe(true);
  });
  test("uploaded financial rows feed revenue, costs, profit, ticket and margin", async () => {
    const csv = "Data;Descrição;Categoria;Entrada;Saída\n07/10/2026;Venda;Vendas;1000;0\n07/10/2026;Compra de estoque;Compras;0;300";
    const rows: Transaction[] = await importTransactionsFromXlsx(new File([csv], "financeiro.csv", { type: "text/csv" }));
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.date)).toEqual(["2026-10-07", "2026-10-07"]);
    const m = computeMetrics(rows);
    expect(m.faturamentoTotal).toBe(1000);
    expect(m.receitaBruta).toBe(1000);
    expect(m.ticketMedio).toBe(1000);
    expect(m.totalCompras).toBe(300);
    expect(m.cmv).toBe(300);
    expect(m.lucroBruto).toBe(700);
    expect(m.margemBruta).toBe(70);
  });
});