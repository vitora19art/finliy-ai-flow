import { useSyncExternalStore } from "react";
import { uid, type ChatMessage, type Transaction } from "./finliy";

export type Thread = { id: string; title: string; updatedAt: number; messages: ChatMessage[] };
type State = { txs: Transaction[]; threads: Thread[] };

const KEY = "finliy:db:v3";
const listeners = new Set<() => void>();
let state: State | null = null;
const EMPTY: State = { txs: [], threads: [] };

export const welcome = (): ChatMessage[] => [
  {
    id: uid(), role: "assistant",
    text: "Olá! 👋 Sou o **FINLIY**, seu assistente de inteligência financeira e empresarial.\n\n📎 **Comece enviando seus arquivos** (Excel, CSV, PDF ou fotos de comprovantes) pelo botão de upload — eu leio, extraio e lanço tudo automaticamente na tabela, DRE, métricas e gráficos.\n\nVocê também pode registrar pelo chat (ex.: *\"vendi 500 reais em produtos de pet\"*) ou pedir *\"Mostre a tabela de DRE\"*.",
  },
];

function read(): State {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? JSON.parse(raw) : { txs: [], threads: [] };
    if (state) {
      const legacyExamples = new Set([
        "2026-07-01|Saldo inicial", "2026-07-02|Venda de produtos pet", "2026-07-03|Pagamento de fornecedores (ração pet)",
        "2026-07-04|Conta de energia", "2026-07-05|Recebimento de cliente", "2026-07-06|Folha de pagamento",
        "2026-07-07|Compra de materiais (acessórios)", "2026-07-08|Venda de serviços", "2026-07-09|Internet e telefone",
        "2026-07-10|Manutenção de equipamentos", "2026-07-11|Venda de acessórios", "2026-07-12|Anúncios no Instagram",
      ]);
      const txs = state.txs.filter((transaction) => !legacyExamples.has(`${transaction.date}|${transaction.description}`));
      if (txs.length !== state.txs.length) {
        state = { ...state, txs };
        localStorage.setItem(KEY, JSON.stringify(state));
      }
    }
  } catch {
    state = { txs: [], threads: [] };
  }
  return state!;
}
function write(next: State) {
  state = next;
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function useDB() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
export const getDB = read;

export const db = {
  addTxs(t: Transaction[]) { const s = read(); write({ ...s, txs: [...s.txs, ...t] }); },
  removeTx(id: string) { const s = read(); write({ ...s, txs: s.txs.filter((t) => t.id !== id) }); },
  clearTxs() { const s = read(); write({ ...s, txs: [] }); },
  createThread(): string {
    const s = read();
    const t: Thread = { id: uid(), title: "Novo chat", updatedAt: Date.now(), messages: welcome() };
    write({ ...s, threads: [t, ...s.threads] });
    return t.id;
  },
  ensureThread(id: string) {
    const s = read();
    if (!s.threads.some((t) => t.id === id))
      write({ ...s, threads: [{ id, title: "Novo chat", updatedAt: Date.now(), messages: welcome() }, ...s.threads] });
  },
  renameThread(id: string, title: string) {
    const s = read();
    write({ ...s, threads: s.threads.map((t) => (t.id === id ? { ...t, title: title.trim() || t.title } : t)) });
  },
  deleteThread(id: string) { const s = read(); write({ ...s, threads: s.threads.filter((t) => t.id !== id) }); },
  updateMessages(id: string, fn: (m: ChatMessage[]) => ChatMessage[]) {
    const s = read();
    write({
      ...s,
      threads: s.threads.map((t) => {
        if (t.id !== id) return t;
        const messages = fn(t.messages);
        const firstUser = messages.find((m) => m.role === "user" && m.block !== "file") ?? messages.find((m) => m.role === "user");
        const title = t.title === "Novo chat" && firstUser ? firstUser.text.replace(/^📎\s*/, "").slice(0, 40) : t.title;
        return { ...t, messages, title, updatedAt: Date.now() };
      }),
    });
  },
};
