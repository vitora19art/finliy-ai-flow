import { useRef, type ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { FileImage, FileSpreadsheet, Sheet } from "lucide-react";
import { toast } from "sonner";
import { brl, type ChartKind } from "@/lib/finliy";
import { dreDetailedRows, dreRows, metricsRows, type Metrics } from "@/lib/metrics";
import { Button } from "@/components/ui/button";

/* ---------------- Exportação ---------------- */
type Rows = (string | number)[][];

export function exportCSV(rows: Rows, name: string) {
  const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  save(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
}
export async function exportXLSX(rows: Rows, name: string) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = (rows[0] ?? []).map((_, i) => ({ wch: Math.max(...rows.map((r) => String(r[i] ?? "").length)) + 2 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "FINLIY");
  XLSX.writeFile(wb, `${name}.xlsx`);
}
async function snap(el: HTMLElement) {
  const { toPng } = await import("html-to-image");
  const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue("--card").trim();
  return toPng(el, { pixelRatio: 2, backgroundColor, filter: (n) => !(n as HTMLElement).dataset?.["noExport"] });
}
export async function exportPNG(el: HTMLElement | null, name: string) {
  if (!el) return;
  try {
    const url = await snap(el);
    const a = document.createElement("a"); a.href = url; a.download = `${name}.png`; a.click();
  } catch { toast.error("Não foi possível gerar a imagem."); }
}
export async function exportPDF(el: HTMLElement | null, name: string) {
  if (!el) return;
  try {
    const url = await snap(el);
    const { jsPDF } = await import("jspdf");
    const img = new Image(); img.src = url; await img.decode();
    const landscape = img.width > img.height;
    const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth() - 48;
    const h = (img.height * pw) / img.width;
    pdf.text("FINLIY", 24, 24);
    pdf.addImage(url, "PNG", 24, 36, pw, Math.min(h, pdf.internal.pageSize.getHeight() - 60));
    pdf.save(`${name}.pdf`);
  } catch { toast.error("Não foi possível gerar o PDF."); }
}
function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function ExportBar({
  rows, name, target, formats,
}: { rows?: Rows; name: string; target?: React.RefObject<HTMLDivElement | null>; formats: ("csv" | "xlsx" | "png" | "pdf")[] }) {
  const btn = "inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:opacity-85";
  return (
    <div className="flex flex-wrap items-center gap-2" data-no-export="true">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Exportar:</span>
      {formats.includes("csv") && rows && <Button size="sm" className={btn} onClick={() => exportCSV(rows, name)}><Sheet className="size-3.5" />CSV</Button>}
      {formats.includes("xlsx") && rows && <Button size="sm" className={btn} onClick={() => exportXLSX(rows, name)}><FileSpreadsheet className="size-3.5" />Excel (.xlsx)</Button>}
      {formats.includes("png") && <Button size="sm" className={btn} onClick={() => exportPNG(target?.current ?? null, name)}><FileImage className="size-3.5" />PNG</Button>}
      {formats.includes("pdf") && <Button size="sm" className={btn} onClick={() => exportPDF(target?.current ?? null, name)}>PDF</Button>}
    </div>
  );
}

export function Card({ title, children, footer, innerRef }: { title: string; children: ReactNode; footer: ReactNode; innerRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div className="space-y-3">
      <div ref={innerRef} className="overflow-hidden rounded-3xl bg-card p-4 shadow-lg ring-1 ring-border sm:p-5">
        <h3 className="pb-3 text-center text-base font-bold tracking-wide text-navy sm:text-lg">{title}</h3>
        {children}
      </div>
      {footer}
    </div>
  );
}

/* ---------------- DRE ---------------- */
export function DreDetailedReport({ m }: { m: Metrics }) {
  const ref = useRef<HTMLDivElement>(null);
  const rows = dreDetailedRows(m);
  const data: Rows = [["Demonstrativo", "Valor (R$)"], ...rows.filter((row) => row.kind !== "section").map((row) => [row.label, row.value])];
  return (
    <Card title="DRE ROBUSTA / DETALHADA" innerRef={ref} footer={<ExportBar rows={data} name="finliy-dre-detalhada" target={ref} formats={["csv", "xlsx", "png", "pdf"]} />}>
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead><tr className="bg-navy text-navy-foreground"><th className="px-3 py-2.5 text-left">Demonstrativo</th><th className="px-3 py-2.5 text-right">Valor (R$)</th></tr></thead>
        <tbody>{rows.map((row) => row.kind === "section" ? (
          <tr key={row.label} className="bg-muted"><th colSpan={2} className="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-wide">{row.label}</th></tr>
        ) : (
          <tr key={row.label} className={`border-b border-border ${row.kind === "result" ? "bg-navy-soft font-bold" : ""}`}>
            <td className="px-3 py-2.5">{row.label}</td><td className={`px-3 py-2.5 text-right ${row.value < 0 ? "text-expense" : row.kind === "result" ? "text-balance" : "text-income"}`}>{brl(row.value)}</td>
          </tr>
        ))}</tbody>
      </table>
      <div className="grid gap-2 pt-3 text-xs text-muted-foreground sm:grid-cols-3"><span>Margem de contribuição: <b>{m.fmt.pct(m.margemContribuicao)}</b></span><span>Margem EBITDA: <b>{m.fmt.pct(m.margemEbitda)}</b></span><span>Margem líquida: <b>{m.fmt.pct(m.margemLiquida)}</b></span></div>
    </Card>
  );
}

export function DreReport({ m }: { m: Metrics }) {
  const ref = useRef<HTMLDivElement>(null);
  const rows = dreRows(m);
  const data: Rows = [["Demonstrativo", "Valor (R$)", "% da Receita"], ...rows.map(([l, v]) => [l, v, m.receitaBruta ? `${((v / m.receitaBruta) * 100).toFixed(1)}%` : "-"])];
  return (
    <Card title="DRE SIMPLIFICADO" innerRef={ref} footer={<ExportBar rows={data} name="finliy-dre" target={ref} formats={["csv", "xlsx", "png", "pdf"]} />}>
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead>
          <tr className="bg-navy text-navy-foreground">
            <th className="px-3 py-2.5 text-left">Demonstrativo</th>
            <th className="px-3 py-2.5 text-right">Valor (R$)</th>
            <th className="px-3 py-2.5 text-right">% Receita</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, v, kind]) => (
            <tr key={label} className={`border-b border-border ${kind === "result" ? "bg-navy-soft font-bold" : ""}`}>
              <td className="px-3 py-2.5">{label}</td>
              <td className={`px-3 py-2.5 text-right ${v < 0 ? "text-expense" : kind === "result" ? "text-balance" : "text-income"}`}>{brl(v)}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{m.receitaBruta ? `${((v / m.receitaBruta) * 100).toFixed(1)}%` : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pt-3 text-xs text-muted-foreground">Margem bruta: <b>{m.fmt.pct(m.margemBruta)}</b> · Margem líquida: <b>{m.fmt.pct(m.margemLiquida)}</b></p>
    </Card>
  );
}

/* ---------------- Métricas ---------------- */
export function BasicMetrics({ m }: { m: Metrics }) {
  const values = [
    ["Faturamento Total", brl(m.faturamentoTotal)],
    ["Receita Bruta", brl(m.receitaBruta)],
    ["Ticket Médio", brl(m.ticketMedio)],
    ["Total de Compras", brl(m.totalCompras)],
    ["CMV", brl(m.cmv)],
    ["Lucro Bruto", brl(m.lucroBruto)],
    ["Margem Bruta (%)", m.fmt.pct(m.margemBruta)],
  ];
  return (
    <section aria-label="Métricas básicas" className="border-b border-border pb-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Métricas básicas</h2>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
        {values.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-lg font-bold tabular-nums text-foreground">{value}</dd></div>)}
      </dl>
    </section>
  );
}

export function MetricsReport({ m }: { m: Metrics }) {
  const ref = useRef<HTMLDivElement>(null);
  const rows = metricsRows(m);
  const groups = [...new Set(rows.map((r) => r[0]))];
  const data: Rows = [["Grupo", "Métrica", "Valor"], ...rows];
  const prodRows: Rows = [["Produto", "Receita", "Custo (CMV)", "Lucro Bruto", "Margem (%)"], ...m.produtos.map((p) => [p.produto, p.receita, p.custo, p.lucro, p.margem.toFixed(1)])];
  return (
    <Card title="MÉTRICAS FINANCEIRAS" innerRef={ref} footer={<ExportBar rows={[...data, [], ...prodRows]} name="finliy-metricas" target={ref} formats={["csv", "xlsx", "png", "pdf"]} />}>
      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <div key={g} className="rounded-2xl bg-muted p-4">
            <p className="pb-2 text-xs font-bold uppercase tracking-wider text-navy">{g}</p>
            <dl className="space-y-2">
              {rows.filter((r) => r[0] === g).map(([, k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-bold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {m.produtos.length > 0 && (
        <table className="mt-4 w-full border-collapse text-sm tabular-nums">
          <thead>
            <tr className="bg-navy text-navy-foreground">
              {["Produto", "Receita", "Custo (CMV)", "Lucro Bruto", "Margem"].map((h) => <th key={h} className="px-3 py-2 text-center">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {m.produtos.map((p) => (
              <tr key={p.produto} className="border-b border-border text-center">
                <td className="px-3 py-2 text-left font-semibold">{p.produto}</td>
                <td className="px-3 py-2 text-income">{brl(p.receita)}</td>
                <td className="px-3 py-2 text-expense">{brl(p.custo)}</td>
                <td className="px-3 py-2 text-balance">{brl(p.lucro)}</td>
                <td className="px-3 py-2 font-bold">{m.fmt.pct(p.margem)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/* ---------------- Gráficos ---------------- */
const PIE = ["var(--navy)", "var(--expense)", "var(--brand)", "var(--income)", "var(--warn)", "var(--plan)", "var(--chart-1)", "var(--chart-2)"];
const TITLES: Record<ChartKind, string> = {
  faturamento: "FATURAMENTO POR PERÍODO",
  compras: "COMPRAS POR PERÍODO",
  comparativo: "FATURAMENTO x COMPRAS x DESPESAS",
  "despesas-pizza": "DESPESAS POR CATEGORIA",
  "saldo-linha": "EVOLUÇÃO DO SALDO",
  "margem-produto": "MARGEM BRUTA POR PRODUTO (%)",
};
const money = (v: number) => brl(v);

export function ChartReport({ kind, m }: { kind: ChartKind; m: Metrics }) {
  const ref = useRef<HTMLDivElement>(null);
  let rows: Rows = [];
  let chart: ReactNode = null;
  const axis = { fontSize: 12 };
  if (kind === "faturamento" || kind === "compras" || kind === "comparativo") {
    const keys = kind === "faturamento" ? ["Faturamento"] : kind === "compras" ? ["Compras"] : ["Faturamento", "Compras", "Despesas"];
    const color: Record<string, string> = { Faturamento: "var(--income)", Compras: "var(--warn)", Despesas: "var(--expense)" };
    const data = m.porPeriodo.filter((d) => keys.some((k) => (d as any)[k] > 0));
    rows = [["Período", ...keys], ...data.map((d) => [d.periodo, ...keys.map((k) => (d as any)[k])])];
    chart = (
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="periodo" tick={axis} />
        <YAxis tick={axis} tickFormatter={(v) => `R$${v / 1000}k`} />
        <Tooltip formatter={money} />
        <Legend />
        {keys.map((k) => <Bar key={k} dataKey={k} fill={color[k]} radius={[6, 6, 0, 0]} />)}
      </BarChart>
    );
  } else if (kind === "despesas-pizza") {
    rows = [["Categoria", "Valor"], ...m.despesasPorCategoria.map((d) => [d.name, d.value])];
    chart = (
      <PieChart>
        <Pie data={m.despesasPorCategoria} dataKey="value" nameKey="name" outerRadius={110} label={(e) => e.name}>
          {m.despesasPorCategoria.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
        </Pie>
        <Tooltip formatter={money} />
        <Legend />
      </PieChart>
    );
  } else if (kind === "saldo-linha") {
    rows = [["Período", "Saldo"], ...m.saldo.map((d) => [d.periodo, d.Saldo])];
    chart = (
      <LineChart data={m.saldo}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="periodo" tick={axis} />
        <YAxis tick={axis} tickFormatter={(v) => `R$${v / 1000}k`} />
        <Tooltip formatter={money} />
        <Line type="monotone" dataKey="Saldo" stroke="var(--balance)" strokeWidth={3} dot />
      </LineChart>
    );
  } else {
    const data = m.produtos.map((p) => ({ produto: p.produto, Margem: Number(p.margem.toFixed(1)) }));
    rows = [["Produto", "Margem (%)"], ...data.map((d) => [d.produto, d.Margem])];
    chart = (
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" unit="%" tick={axis} />
        <YAxis type="category" dataKey="produto" tick={axis} width={90} />
        <Tooltip formatter={(v: number) => `${v}%`} />
        <Bar dataKey="Margem" fill="var(--brand)" radius={[0, 6, 6, 0]} />
      </BarChart>
    );
  }
  return (
    <Card title={TITLES[kind]} innerRef={ref} footer={<ExportBar rows={rows} name={`finliy-grafico-${kind}`} target={ref} formats={["png", "pdf", "csv", "xlsx"]} />}>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">{chart as any}</ResponsiveContainer>
      </div>
    </Card>
  );
}
