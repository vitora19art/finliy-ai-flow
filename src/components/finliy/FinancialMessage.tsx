import { useRef } from "react";
import { fmtDate, type Transaction } from "@/lib/finliy";
import { FinanceTable, withBalance } from "./Tables";
import { ExportBar } from "./Reports";

export function FinancialMessage({ txs }: { txs: Transaction[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const rows = withBalance(txs);
  const income = txs.filter((t) => t.type === "Receita").reduce((sum, t) => sum + t.amount, 0);
  const expense = txs.filter((t) => t.type === "Despesa").reduce((sum, t) => sum + t.amount, 0);
  const data = [
    ["Data", "Descrição", "Categoria", "Entrada (R$)", "Saída (R$)", "Saldo (R$)"],
    ...rows.map((r) => [fmtDate(r.date), r.description, r.category, r.type === "Receita" ? r.amount : "-", r.type === "Despesa" ? r.amount : "-", r.balance]),
    ["TOTAL", "", "", income, expense, income - expense],
  ];
  return (
    <div className="space-y-3">
      <div ref={ref}><FinanceTable txs={txs} /></div>
      <ExportBar rows={data} name="finliy-controle-financeiro" target={ref} formats={["csv", "xlsx", "png", "pdf"]} />
    </div>
  );
}