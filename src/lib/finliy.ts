export type Plan = "pessoal" | "empresarial";

export type Transaction = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  description: string;
  category: string;
  type: "Receita" | "Despesa";
  amount: number;
  product?: string;
};

export type RoutineItem = {
  id: string;
  time: string;
  activity: string;
  duration: string;
  done: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  block?: "finance" | "routine" | "blocked" | "file" | "dre" | "metrics" | "chart";
  chart?: ChartKind;
  file?: { name: string; size: number };
};

export type ChartKind = "faturamento" | "compras" | "comparativo" | "despesas-pizza" | "saldo-linha" | "margem-produto";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const seedTransactions: Transaction[] = [
  { id: uid(), date: "2026-07-01", description: "Saldo inicial", category: "Saldo inicial", type: "Receita", amount: 10000 },
  { id: uid(), date: "2026-07-02", description: "Venda de produtos pet", category: "Vendas", type: "Receita", amount: 3500, product: "Pet" },
  { id: uid(), date: "2026-07-03", description: "Pagamento de fornecedores (ração pet)", category: "Fornecedores", type: "Despesa", amount: 2000, product: "Pet" },
  { id: uid(), date: "2026-07-04", description: "Conta de energia", category: "Contas e Utilidades", type: "Despesa", amount: 450 },
  { id: uid(), date: "2026-07-05", description: "Recebimento de cliente", category: "Recebimentos", type: "Receita", amount: 1800, product: "Serviços" },
  { id: uid(), date: "2026-07-06", description: "Folha de pagamento", category: "Folha de Pagamento", type: "Despesa", amount: 4200 },
  { id: uid(), date: "2026-07-07", description: "Compra de materiais (acessórios)", category: "Compras", type: "Despesa", amount: 900, product: "Acessórios" },
  { id: uid(), date: "2026-07-08", description: "Venda de serviços", category: "Serviços", type: "Receita", amount: 2600, product: "Serviços" },
  { id: uid(), date: "2026-07-09", description: "Internet e telefone", category: "Contas e Utilidades", type: "Despesa", amount: 180 },
  { id: uid(), date: "2026-07-10", description: "Manutenção de equipamentos", category: "Manutenção", type: "Despesa", amount: 520 },
  { id: uid(), date: "2026-07-11", description: "Venda de acessórios", category: "Vendas", type: "Receita", amount: 1400, product: "Acessórios" },
  { id: uid(), date: "2026-07-12", description: "Anúncios no Instagram", category: "Marketing", type: "Despesa", amount: 300 },
];

const r = (time: string, activity: string, duration: string): RoutineItem => ({
  id: uid(), time, activity, duration, done: false,
});

export const seedRoutine: RoutineItem[] = [
  r("06:00", "☀️ Acordar e alongamento", "30 min"),
  r("06:30", "💧 Beber água e higiene pessoal", "30 min"),
  r("07:00", "🏃 Exercício físico", "45 min"),
  r("07:30", "🚿 Banho e se arrumar", "30 min"),
  r("08:00", "🥣 Café da manhã", "30 min"),
  r("08:30", "📘 Ler ou estudar", "1 h"),
  r("09:30", "💼 Trabalhar / Estudar", "2 h"),
  r("11:30", "☕ Pausa / Café", "15 min"),
  r("11:45", "💼 Trabalhar / Estudar", "2 h"),
  r("13:45", "🍲 Almoço", "1 h"),
  r("14:45", "🚶 Caminhada leve", "30 min"),
  r("15:15", "📘 Estudar / Cursos / Projetos", "1 h 30 min"),
  r("16:45", "🍎 Lanche da tarde", "30 min"),
  r("17:15", "📋 Planejamento do dia seguinte", "30 min"),
  r("17:45", "🏋️ Treino ou atividade física", "1 h"),
  r("18:45", "🚿 Banho", "30 min"),
  r("19:15", "👨‍👩‍👧 Tempo com a família / Amigos", "1 h"),
  r("20:15", "📖 Leitura / Desenvolvimento pessoal", "45 min"),
  r("21:00", "🍽️ Jantar", "45 min"),
  r("21:45", "📺 Tempo livre (filmes, séries, hobbies)", "1 h"),
  r("22:45", "📝 Escrever no diário / Gratidão", "15 min"),
  r("23:00", "🌙 Preparar para dormir", "30 min"),
  r("23:30", "🛏️ Dormir", "-"),
];

export const seedNotes =
  "Manter o foco, ter disciplina e consistência. Pequenas ações todos os dias levam a grandes resultados!";

/* ---------------- "IA" de interpretação de frases ---------------- */

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const INCOME = ["vendi", "venda", "vendas", "recebi", "receb", "receita", "entrada", "ganhei", "faturei", "faturamento", "lucro", "pagaram", "deposit"];
const EXPENSE = ["paguei", "pagamento", "pagar", "comprei", "compra", "compras", "gastei", "gasto", "despesa", "saida", "conta de", "boleto", "fatura", "investi"];

/** Detecta se a frase fala de vendas/compras/movimentação financeira. */
export function isFinancialCommand(text: string) {
  const t = norm(text);
  const hasMoney = /(r\$|reais|real\b|\d+[.,]?\d*\s*(mil|k)\b)/.test(t);
  const kw = [...INCOME, ...EXPENSE].some((k) => t.includes(k));
  return kw || (hasMoney && /\d/.test(t));
}

export function parseAmount(text: string): number | null {
  const t = norm(text).replace(/r\$\s*/g, "");
  const m = t.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(mil|k)?/);
  if (!m) return null;
  let raw = m[1];
  if (/\.\d{3}/.test(raw)) raw = raw.replace(/\./g, "");
  raw = raw.replace(",", ".");
  let n = parseFloat(raw);
  if (isNaN(n)) return null;
  if (m[2]) n *= 1000;
  return n;
}

const CATEGORIES: [string[], string][] = [
  [["fornecedor"], "Fornecedores"],
  [["folha", "salario", "funcionario"], "Folha de Pagamento"],
  [["energia", "luz", "agua", "internet", "telefone", "gas"], "Contas e Utilidades"],
  [["aluguel"], "Aluguel"],
  [["manutencao", "conserto"], "Manutenção"],
  [["imposto", "taxa", "das", "tributo"], "Impostos"],
  [["marketing", "anuncio", "propaganda"], "Marketing"],
  [["servico"], "Serviços"],
  [["vendi", "venda", "vendas", "faturei"], "Vendas"],
  [["recebi", "cliente"], "Recebimentos"],
  [["comprei", "compra", "material", "estoque", "mercadoria"], "Compras"],
];

const REPORT = /(grafico|dre|tabela|planilha|relatorio|mostr|exib|gere|gerar|qual|quanto|como|metrica|indicador|resumo|analis|\?)/;
const ACTION = /(vendi|recebi|faturei|ganhei|paguei|comprei|gastei|investi|venda de|compra de|pagamento de|recebimento de|entrou|saiu|lancar|registr)/;

/** Mensagem que registra uma entrada/saída (e não uma pergunta/relatório). */
export function isTransactionMessage(text: string) {
  const t = norm(text);
  if (REPORT.test(t) && !/^(registr|lanc)/.test(t)) return false;
  const p = parseTransaction(text);
  return ACTION.test(t) && !!p.type && !!p.amount;
}

const STOP = new Set(["reais", "real", "produto", "produtos", "hoje", "ontem", "um", "uma", "cliente", "clientes", "r"]);
export function extractProduct(text: string): string | undefined {
  const t = norm(text);
  const re = /\b(?:de|em|com|do|da|dos|das)\s+([a-z]{3,})/g;
  let m: RegExpExecArray | null; let found: string | undefined;
  while ((m = re.exec(t))) if (!STOP.has(m[1])) found = m[1];
  return found ? found.charAt(0).toUpperCase() + found.slice(1) : undefined;
}

export type ParsedTransaction = {
  type: "Receita" | "Despesa" | null;
  category: string | null;
  amount: number | null;
  description: string;
  product?: string;
};

export function parseTransaction(text: string): ParsedTransaction {
  const t = norm(text);
  const incomeHit = INCOME.some((k) => t.includes(k));
  const expenseHit = EXPENSE.some((k) => t.includes(k));
  let type: ParsedTransaction["type"] = null;
  if (incomeHit && !expenseHit) type = "Receita";
  else if (expenseHit && !incomeHit) type = "Despesa";
  else if (incomeHit && expenseHit) type = /vendi|recebi|faturei/.test(t) ? "Receita" : "Despesa";
  let category: string | null = null;
  for (const [keys, cat] of CATEGORIES) {
    if (keys.some((k) => t.includes(k))) { category = cat; break; }
  }
  if (!category && type) category = type === "Receita" ? "Receitas Diversas" : "Despesas Diversas";
  const clean = text.trim().replace(/\s+/g, " ");
  return {
    type,
    category,
    amount: parseAmount(text),
    description: clean.charAt(0).toUpperCase() + clean.slice(1),
    product: extractProduct(text),
  };
}

/** Comando de rotina: "adicionar 07:00 corrida 30 min" */
export function parseRoutineCommand(text: string): Omit<RoutineItem, "id" | "done"> | null {
  const time = text.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/);
  if (!time) return null;
  const dur = text.match(/(\d+\s*h(?:oras?)?(?:\s*\d+\s*min)?|\d+\s*min(?:utos)?)/i);
  let activity = text
    .replace(time[0], "")
    .replace(dur?.[0] ?? "", "")
    .replace(/\b(adicion(e|ar)|inclu(a|ir)|agend(e|ar)|coloc(a|ar)|as|às|por|de|na rotina|rotina)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!activity) activity = "Nova atividade";
  const hh = time[1].padStart(2, "0");
  return {
    time: `${hh}:${time[2]}`,
    activity: activity.charAt(0).toUpperCase() + activity.slice(1),
    duration: dur ? dur[0].replace(/horas?/i, "h").replace(/minutos/i, "min") : "-",
  };
}

export const ACCEPTED_EXT = ["csv", "pdf", "doc", "docx", "jpg", "jpeg", "png", "zip", "xlsx"];
export const MAX_BYTES = 20 * 1024 * 1024;

export const fmtSize = (b: number) =>
  b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
