import { brl, fmtDate, type RoutineItem, type Transaction } from "@/lib/finliy";

export function monthTitle(txs: Transaction[]) {
  const last = txs[txs.length - 1]?.date ?? new Date().toISOString().slice(0, 10);
  const [y, m] = last.split("-");
  const names = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  return `CONTROLE FINANCEIRO - ${names[Number(m) - 1]}/${y}`;
}

export function withBalance(txs: Transaction[]) {
  let bal = 0;
  return [...txs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      bal += t.type === "Receita" ? t.amount : -t.amount;
      return { ...t, balance: bal };
    });
}

export function FinanceTable({ txs }: { txs: Transaction[] }) {
  const rows = withBalance(txs);
  const totIn = rows.filter((r) => r.type === "Receita").reduce((s, r) => s + r.amount, 0);
  const totOut = rows.filter((r) => r.type === "Despesa").reduce((s, r) => s + r.amount, 0);
  return (
    <div className="overflow-hidden rounded-3xl bg-card shadow-lg ring-1 ring-border">
      <h3 className="py-3 text-center text-base font-bold tracking-wide text-navy sm:text-lg">{monthTitle(txs)}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm tabular-nums">
          <thead>
            <tr className="bg-navy text-navy-foreground">
              {["Data", "Descrição", "Categoria", "Entrada (R$)", "Saída (R$)", "Saldo (R$)"].map((h) => (
                <th key={h} className="border-r border-navy-foreground/20 px-3 py-2.5 text-center font-semibold last:border-r-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <td className="border-r border-border px-3 py-2">{fmtDate(r.date)}</td>
                <td className="border-r border-border px-3 py-2">{r.description}</td>
                <td className="border-r border-border px-3 py-2 text-center">{r.category}</td>
                <td className="border-r border-border px-3 py-2 text-center text-income">{r.type === "Receita" ? brl(r.amount) : "-"}</td>
                <td className="border-r border-border px-3 py-2 text-center text-expense">{r.type === "Despesa" ? brl(r.amount) : "-"}</td>
                <td className={`px-3 py-2 text-center ${r.balance < 0 ? "text-expense" : "text-balance"}`}>{brl(r.balance)}</td>
              </tr>
            ))}
            <tr className="bg-navy-soft font-bold">
              <td colSpan={3} className="px-3 py-2.5 text-center">TOTAL</td>
              <td className="border-x border-border px-3 py-2.5 text-center text-income">{brl(totIn)}</td>
              <td className="border-r border-border px-3 py-2.5 text-center text-expense">{brl(totOut)}</td>
              <td className={`px-3 py-2.5 text-center ${totIn - totOut < 0 ? "text-expense" : "text-balance"}`}>{brl(totIn - totOut)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RoutineTable({
  items, notes, onToggle, onNotes, onRemove,
}: {
  items: RoutineItem[];
  notes: string;
  onToggle: (id: string) => void;
  onNotes: (v: string) => void;
  onRemove: (id: string) => void;
}) {
  const done = items.filter((i) => i.done).length;
  const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
  return (
    <div className="overflow-hidden rounded-3xl bg-card p-3 shadow-lg ring-1 ring-border sm:p-4">
      <div className="flex items-center gap-3 pb-3">
        <span className="h-px flex-1 bg-foreground" />
        <h3 className="text-lg font-extrabold tracking-tight sm:text-2xl">• TABELA DE ROTINA •</h3>
        <span className="h-px flex-1 bg-foreground" />
      </div>
      <p className="pb-2 text-right text-xs text-muted-foreground">{done} de {items.length} concluídas</p>
      <div className="overflow-x-auto rounded-lg ring-1 ring-border">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs uppercase">
              <th className="px-3 py-2 text-center font-semibold">Horário</th>
              <th className="px-3 py-2 text-center font-semibold">Atividade</th>
              <th className="px-3 py-2 text-center font-semibold">Duração</th>
              <th className="px-3 py-2 text-center font-semibold">Concluído</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((i) => (
              <tr key={i.id} className="group border-b border-border last:border-b-0">
                <td className="border-r border-border px-3 py-1.5 text-center font-bold">{i.time}</td>
                <td className={`border-r border-border px-3 py-1.5 ${i.done ? "text-muted-foreground line-through" : ""}`}>
                  <span className="flex items-center justify-between gap-2">
                    {i.activity}
                    <button onClick={() => onRemove(i.id)} className="text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-expense" aria-label={`Remover ${i.activity}`}>✕</button>
                  </span>
                </td>
                <td className="border-r border-border px-3 py-1.5 text-center">{i.duration}</td>
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={i.done}
                    onChange={() => onToggle(i.id)}
                    aria-label={`Concluído: ${i.activity}`}
                    className="size-4 cursor-pointer accent-brand"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex overflow-hidden rounded-lg ring-1 ring-border">
        <label htmlFor="notas" className="flex items-center bg-primary px-3 text-xs font-bold text-primary-foreground">NOTAS:</label>
        <textarea
          id="notas"
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          rows={2}
          placeholder="Escreva suas notas aqui…"
          className="flex-1 resize-none bg-card px-3 py-2 font-serif text-sm outline-none"
        />
      </div>
    </div>
  );
}
