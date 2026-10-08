import { parseAmount, parseTransaction, todayISO, uid, type Transaction } from "./finliy";

const n = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

function toISO(v: unknown): string {
  if (typeof v === "number" && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const m = String(v ?? "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m?.[1] && m[2] && m[3]) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const iso = String(v ?? "").match(/\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : todayISO();
}
const num = (v: unknown) => (typeof v === "number" ? v : parseAmount(String(v ?? "")) ?? 0);

/** Lê uma planilha .xlsx e converte em transações (colunas: Data, Descrição, Categoria, Entrada, Saída ou Valor/Tipo). */
export async function importTransactionsFromXlsx(file: File): Promise<Transaction[]> {
  const XLSX = await import("xlsx");
  const wb = file.name.toLowerCase().endsWith(".csv")
    ? XLSX.read(await file.text(), { type: "string", raw: true })
    : XLSX.read(await file.arrayBuffer());
  const out: Transaction[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
    const hIdx = rows.findIndex((r) => r.some((c) => /descri|historico/.test(n(c))));
    if (hIdx < 0) continue;
    const header = rows[hIdx];
    if (!header) continue;
    const h = header.map(n);
    const col = (re: RegExp) => h.findIndex((c) => re.test(c));
    const cData = col(/^data/), cDesc = col(/descri|historico/), cCat = col(/categ/),
      cIn = col(/entrada|receita|credito/), cOut = col(/saida|despesa|debito/), cVal = col(/^valor/), cTipo = col(/tipo/);
    for (const r of rows.slice(hIdx + 1)) {
      const desc = String(r[cDesc] ?? "").trim();
      if (!desc || /^total/i.test(desc)) continue;
      let type: Transaction["type"] | null = null;
      let amount = 0;
      const vin = cIn >= 0 ? num(r[cIn]) : 0;
      const vout = cOut >= 0 ? num(r[cOut]) : 0;
      if (vin > 0) { type = "Receita"; amount = vin; }
      else if (vout > 0) { type = "Despesa"; amount = vout; }
      else if (cVal >= 0) {
        const v = num(r[cVal]);
        amount = Math.abs(v);
        const tipo = n(cTipo >= 0 ? r[cTipo] : "");
        type = /desp|said|debi/.test(tipo) || v < 0 ? "Despesa" : "Receita";
      }
      if (!type || !amount) continue;
      const p = parseTransaction(desc);
      const rawCat = cCat >= 0 ? String(r[cCat] ?? "").trim() : "";
      const category = /saldo inicial/i.test(desc) ? "Saldo inicial"
        : rawCat && !/^(receita|despesa|-)$/i.test(rawCat) ? rawCat : p.category ?? (type === "Receita" ? "Receitas Diversas" : "Despesas Diversas");
      out.push({ id: uid(), date: toISO(cData >= 0 ? r[cData] : ""), description: desc, category, type, amount, product: p.product });
    }
  }
  return out;
}

/** Converte todas as abas da planilha em texto CSV (para leitura pela IA quando as colunas não são reconhecidas). */
export async function sheetToText(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = file.name.toLowerCase().endsWith(".csv")
    ? XLSX.read(await file.text(), { type: "string", raw: true })
    : XLSX.read(await file.arrayBuffer());
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    return sheet ? `# ${name}\n${XLSX.utils.sheet_to_csv(sheet)}` : "";
  }).join("\n\n").slice(0, 190_000);
}
