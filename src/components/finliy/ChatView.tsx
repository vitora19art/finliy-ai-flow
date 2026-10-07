import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import {
  Check, Copy, FileText, Menu, Mic, Pencil, Plus, RefreshCw, SendHorizontal,
  Square, Trash2, UserCircle2, X, Paperclip, MessageSquare, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  type ChartKind, type ChatMessage, type Transaction,
  brl, fmtDate, fmtSize, isTransactionMessage, parseTransaction, todayISO, uid,
} from "@/lib/finliy";
import { aiContext, computeMetrics } from "@/lib/metrics";
import { importTransactionsFromXlsx, sheetToText } from "@/lib/importXlsx";
import { db, getDB, useDB } from "@/lib/store";
import { FinanceTable, withBalance } from "./Tables";
import { UploadModal } from "./Modals";
import { ChartReport, DreReport, ExportBar, MetricsReport } from "./Reports";

const SUGGESTIONS = [
  "Mostre a tabela de DRE",
  "Gere um gráfico do faturamento por período",
  "Mostre as métricas financeiras",
  "Gráfico de pizza das despesas",
  "Produtos com maior e menor margem",
  "Como posso cortar custos?",
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function detectReport(text: string): Pick<ChatMessage, "block" | "chart" | "text"> | null {
  const t = norm(text);
  if (/grafico|chart|pizza|linha|barras/.test(t)) {
    let chart: ChartKind = "comparativo";
    if (/pizza|categoria/.test(t) || (/despesa/.test(t) && !/faturamento/.test(t))) chart = "despesas-pizza";
    else if (/saldo|evolu|linha/.test(t)) chart = "saldo-linha";
    else if (/margem|produto/.test(t)) chart = "margem-produto";
    else if (/compra|custo/.test(t) && !/faturamento|receita|venda/.test(t)) chart = "compras";
    else if (/faturamento|receita|venda/.test(t) && !/compra|versus|\bvs\b|\bx\b/.test(t)) chart = "faturamento";
    return { block: "chart", chart, text: "Aqui está o gráfico solicitado 📊" };
  }
  if (/\bdre\b|demonstrativo|resultado liquido/.test(t)) return { block: "dre", text: "Aqui está a sua DRE simplificada." };
  if (/metrica|indicador|kpi|ticket|cmv|margem|lucro bruto|faturamento total|receita bruta|custo de aquisicao|total de compras/.test(t))
    return { block: "metrics", text: "Aqui estão suas métricas financeiras." };
  if (/tabela|planilha|extrato|lancamentos|fluxo de caixa/.test(t)) return { block: "finance", text: "Perfeito, aqui está a sua tabela" };
  return null;
}

const readDataUrl = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

async function extractWithAI(f: File, text?: string): Promise<{ transactions: Transaction[]; summary: string }> {
  const body = text
    ? { fileName: f.name, mime: f.type || "text/csv", text }
    : { fileName: f.name, mime: f.type || "application/pdf", dataUrl: await readDataUrl(f) };
  const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Não foi possível ler o arquivo.");
  const txs: Transaction[] = (data.transactions ?? [])
    .filter((t: any) => t && t.amount > 0 && (t.type === "Receita" || t.type === "Despesa"))
    .map((t: any) => ({
      id: uid(),
      date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : todayISO(),
      description: String(t.description || "Lançamento").slice(0, 120),
      category: String(t.category || (t.type === "Receita" ? "Receitas Diversas" : "Despesas Diversas")),
      type: t.type,
      amount: Number(t.amount),
      product: t.product || undefined,
    }));
  return { transactions: txs, summary: data.summary ?? "" };
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 48 48" className="size-9" aria-hidden>
        <path d="M24 6a18 18 0 1 0 17 24" fill="none" className="stroke-brand" strokeWidth="5" strokeLinecap="round" />
        <path d="M22 1l8 5-8 5z" className="fill-brand" />
        <rect x="16" y="13" width="20" height="24" rx="3" fill="none" className="stroke-foreground" strokeWidth="3" />
        <rect x="28" y="21" width="10" height="8" rx="2" className="fill-card stroke-foreground" strokeWidth="3" />
        <circle cx="32" cy="25" r="1.6" className="fill-foreground" />
      </svg>
      <span className="text-2xl font-extrabold tracking-tight">FINLIY</span>
    </div>
  );
}

export default function ChatView({ threadId }: { threadId: string }) {
  const navigate = useNavigate();
  const { txs, threads } = useDB();
  const thread = threads.find((t) => t.id === threadId);
  const messages = thread?.messages ?? [];
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [aborter, setAborter] = useState<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const financeRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => computeMetrics(txs), [txs]);

  useEffect(() => { db.ensureThread(threadId); }, [threadId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => { if (!busy) inputRef.current?.focus(); }, [busy, threadId]);

  const push = (...m: ChatMessage[]) => db.updateMessages(threadId, (x) => [...x, ...m]);
  const patch = (id: string, text: string) => db.updateMessages(threadId, (x) => x.map((m) => (m.id === id ? { ...m, text } : m)));

  function localResponse(text: string): ChatMessage | null {
    if (isTransactionMessage(text)) {
      const pt = parseTransaction(text);
      const tx: Transaction = { id: uid(), date: todayISO(), description: pt.description, category: pt.category!, type: pt.type!, amount: pt.amount!, product: pt.product };
      if (!Number.isFinite(tx.amount) || tx.amount <= 0) return { id: uid(), role: "assistant", text: "Não consegui identificar um valor válido. Informe o valor, por exemplo: *\"comprei 200 reais de embalagem\"*." };
      return {
        id: uid(), role: "assistant", block: "confirm", pending: tx,
        text: `Confira os dados antes de registrar:\n\n- **Tipo:** ${tx.type}\n- **Valor:** ${brl(tx.amount)}\n- **Categoria:** ${tx.category}${tx.product ? `\n- **Produto:** ${tx.product}` : ""}\n- **Data:** ${fmtDate(tx.date)}`,
      };
    }
    const rep = detectReport(text);
    return rep ? { id: uid(), role: "assistant", ...rep } : null;
  }

  async function aiResponse(history: ChatMessage[]) {
    const id = uid();
    push({ id, role: "assistant", text: "" });
    const ctrl = new AbortController();
    setAborter(ctrl);
    const cur = getDB();
    const context = aiContext(computeMetrics(cur.txs), cur.txs);
    const msgs = history.filter((m) => m.text && m.block !== "file").slice(-20).map((m) => ({ role: m.role, content: m.text.slice(0, 6000) }));
    let acc = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "empresarial", context: context.slice(0, 8000), messages: msgs }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        patch(id, `⚠️ ${(await res.text().catch(() => "")) || "Não consegui responder agora. Tente novamente."}`);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const ev = JSON.parse(data);
            if (ev.type === "response.output_text.delta") { acc += ev.delta; patch(id, acc); }
            else if (ev.type === "error" || ev.type === "response.failed") { acc += "\n\n⚠️ A IA encontrou um problema ao responder."; patch(id, acc); }
          } catch { /* parcial */ }
        }
      }
      if (!acc) patch(id, "⚠️ Não recebi uma resposta. Tente novamente.");
    } catch (e) {
      if ((e as Error).name === "AbortError") patch(id, acc || "_(resposta interrompida)_");
      else patch(id, "⚠️ Falha de conexão com a IA. Tente novamente.");
    } finally {
      setAborter(null);
    }
  }

  async function run(text: string, history: ChatMessage[]) {
    setBusy(true);
    const local = localResponse(text);
    if (local) { await new Promise((r) => setTimeout(r, 350)); push(local); }
    else await aiResponse(history);
    setBusy(false);
  }

  function send(text = input) {
    const v = text.trim();
    if (!v || busy) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", text: v };
    push(userMsg);
    setInput("");
    run(v, [...messages, userMsg]);
  }

  function redo(idx: number) {
    if (busy) return;
    const before = messages.slice(0, idx);
    const prev = [...before].reverse().find((m) => m.role === "user" && m.block !== "file");
    const target = messages[idx];
    if (!prev) { toast.info("Nada para refazer aqui."); return; }
    db.updateMessages(threadId, (x) => x.filter((_, i) => i !== idx));
    if (isTransactionMessage(prev.text)) { push({ id: uid(), role: "assistant", text: "Refeito! Aqui está a sua tabela atualizada.", block: "finance" }); return; }
    if (target?.block) { push({ ...target, id: uid() }); return; }
    run(prev.text, before);
  }

  function financeRows(): (string | number)[][] {
    const rows = withBalance(txs);
    const i = rows.filter((r) => r.type === "Receita").reduce((s, r) => s + r.amount, 0);
    const o = rows.filter((r) => r.type === "Despesa").reduce((s, r) => s + r.amount, 0);
    return [
      ["Data", "Descrição", "Categoria", "Entrada (R$)", "Saída (R$)", "Saldo (R$)"],
      ...rows.map((r) => [fmtDate(r.date), r.description, r.category, r.type === "Receita" ? r.amount : "-", r.type === "Despesa" ? r.amount : "-", r.balance]),
      ["TOTAL", "", "", i, o, i - o],
    ];
  }

  function copy(m: ChatMessage) {
    navigator.clipboard.writeText(m.block === "finance" ? financeRows().map((r) => r.join("\t")).join("\n") : m.text);
    toast.success("Copiado! Cole direto no Excel.");
  }

  async function onFiles(files: File[]) {
    setBusy(true);
    for (const f of files) {
      push({ id: uid(), role: "user", text: `📎 ${f.name}`, block: "file", file: { name: f.name, size: f.size } });
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const statusId = uid();
      push({ id: statusId, role: "assistant", text: `🔎 Lendo **${f.name}** e extraindo as movimentações financeiras…` });
      try {
        let result: { transactions: Transaction[]; summary: string } = { transactions: [], summary: "" };
        if (ext === "xlsx" || ext === "csv") {
          const direct = await importTransactionsFromXlsx(f);
          result = direct.length ? { transactions: direct, summary: "Planilha importada pelas colunas identificadas." } : await extractWithAI(f, await sheetToText(f));
        } else if (["pdf", "jpg", "jpeg", "png"].includes(ext)) {
          result = await extractWithAI(f);
        } else {
          patch(statusId, `Recebi **${f.name}** (${fmtSize(f.size)}) e ele ficou anexado à conversa. Para a leitura automática, envie o conteúdo em **PDF, Excel (.xlsx), CSV ou imagem** — arquivos ${ext.toUpperCase()} ainda não são lidos automaticamente nesta versão Beta.`);
          continue;
        }
        if (!result.transactions.length) {
          patch(statusId, `Li o arquivo **${f.name}**, mas não encontrei movimentações financeiras. ${result.summary}`);
          continue;
        }
        db.addTxs(result.transactions);
        const inc = result.transactions.filter((t) => t.type === "Receita").reduce((s, t) => s + t.amount, 0);
        const out = result.transactions.filter((t) => t.type === "Despesa").reduce((s, t) => s + t.amount, 0);
        db.updateMessages(threadId, (x) => x.map((m) => m.id === statusId ? {
          ...m, block: "finance",
          text: `📥 Pronto! Extraí **${result.transactions.length} lançamentos** de **${f.name}**: ${brl(inc)} em entradas e ${brl(out)} em saídas.${result.summary ? `\n\n_${result.summary}_` : ""}\n\nTabela, DRE, métricas e gráficos já usam esses dados.`,
        } : m));
      } catch (e) {
        patch(statusId, `⚠️ ${(e as Error).message || "Não consegui ler este arquivo."}`);
      }
    }
    setBusy(false);
  }

  function voice() {
    const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) { toast.error("Seu navegador não suporta digitação por voz."); return; }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.onresult = (e: any) => setInput(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  function newChat() {
    const id = db.createThread();
    setMenu(false);
    navigate({ to: "/c/$threadId", params: { threadId: id } });
  }

  function removeThread(id: string) {
    if (!confirm("Excluir esta conversa?")) return;
    db.deleteThread(id);
    if (id === threadId) {
      const next = getDB().threads[0];
      if (next) navigate({ to: "/c/$threadId", params: { threadId: next.id } });
      else newChat();
    }
  }

  const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);

  const Sidebar = (
    <nav className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <Logo />
        <button onClick={() => setMenu(false)} className="lg:hidden" aria-label="Fechar menu"><X /></button>
      </div>
      <button onClick={newChat} className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90">
        <Plus className="size-4" /> Novo Chat
      </button>
      <p className="pt-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Conversas</p>
      <div className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
        {sorted.map((t) => {
          const active = t.id === threadId;
          return (
            <div key={t.id} className={`group flex items-center gap-1 rounded-xl px-2 py-1.5 ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {editing?.id === t.id ? (
                <form className="flex flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); db.renameThread(t.id, editing.title); setEditing(null); }}>
                  <input autoFocus value={editing.title} onChange={(e) => setEditing({ id: t.id, title: e.target.value })} onBlur={() => { db.renameThread(t.id, editing.title); setEditing(null); }} className="min-w-0 flex-1 rounded-md bg-card px-2 py-1 text-sm text-foreground outline-none ring-1 ring-ring" />
                  <button type="submit" aria-label="Salvar nome"><Check className="size-4" /></button>
                </form>
              ) : (
                <>
                  <Link to="/c/$threadId" params={{ threadId: t.id }} onClick={() => setMenu(false)} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-sm font-semibold">
                    <MessageSquare className="size-4 shrink-0 opacity-70" />
                    <span className="truncate">{t.title}</span>
                  </Link>
                  <button onClick={() => setEditing({ id: t.id, title: t.title })} aria-label="Renomear conversa" className="rounded p-1 opacity-60 hover:opacity-100"><Pencil className="size-3.5" /></button>
                  <button onClick={() => removeThread(t.id)} aria-label="Excluir conversa" className="rounded p-1 opacity-60 hover:text-expense hover:opacity-100"><Trash2 className="size-3.5" /></button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
        <b className="text-foreground">{txs.length}</b> lançamentos na base · Saldo <b className="text-foreground">{brl(metrics.receitaBruta + (txs.find((t) => t.category === "Saldo inicial")?.amount ?? 0) - metrics.cmv - metrics.despesasOperacionais)}</b>
      </div>
    </nav>
  );

  const lastIdx = messages.length - 1;
  const typing = (
    <div className="inline-flex gap-1.5 rounded-full bg-brand px-5 py-4" aria-label="FINLIY está pensando">
      {[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-brand-foreground animate-blink" style={{ animationDelay: `${i * 0.2}s` }} />)}
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div role="status" className="z-40 shrink-0 bg-warn px-4 py-2 text-center text-xs font-semibold text-warn-foreground sm:text-sm">
        ⚠️ Esta é uma versão Beta de validação (MVP) criada para testes. Pode conter pequenos erros. Por favor, deixe seu feedback para ajustarmos o app às necessidades reais da sua empresa!
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-border bg-sidebar lg:block">{Sidebar}</aside>
        {menu && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <aside className="w-72 bg-sidebar shadow-2xl">{Sidebar}</aside>
            <button className="flex-1 bg-foreground/40" onClick={() => setMenu(false)} aria-label="Fechar menu" />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setMenu(true)} className="lg:hidden" aria-label="Abrir menu"><Menu className="size-7" /></button>
              <Logo className="lg:hidden" />
              <div className="hidden min-w-0 lg:block">
                <h1 className="truncate text-lg font-extrabold">{thread?.title ?? "Novo chat"}</h1>
                <p className="text-xs text-muted-foreground">Assistente de inteligência financeira e empresarial</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <UserCircle2 className="hidden size-9 sm:block" strokeWidth={1.5} aria-label="Perfil" />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-background px-3 py-6 sm:px-8">
            <div className="mx-auto max-w-5xl space-y-5">
              {messages.map((m, idx) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end animate-rise">
                    <div className="max-w-[85%] rounded-[2rem] bg-primary px-5 py-3.5 text-right text-sm font-semibold text-primary-foreground sm:max-w-[60%] sm:text-base">
                      {m.block === "file" && m.file ? (
                        <span className="flex items-center gap-2"><Paperclip className="size-4" />{m.file.name} <span className="font-normal opacity-60">· {fmtSize(m.file.size)}</span></span>
                      ) : m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="space-y-3 animate-rise">
                    {m.text ? (
                      <div className="inline-block max-w-[90%] rounded-[2rem] bg-brand px-5 py-3.5 text-sm font-semibold text-brand-foreground sm:max-w-[70%] sm:text-base [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-extrabold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_h1]:font-extrabold [&_h2]:font-extrabold [&_h3]:font-extrabold">
                        {m.text.startsWith("🔎") && <Loader2 className="mr-2 inline size-4 animate-spin" />}
                        <ReactMarkdown>{m.text}</ReactMarkdown>
                      </div>
                    ) : typing}
                    {m.block === "confirm" && m.pending && (
                      m.status ? (
                        <p className="pl-2 text-sm font-bold text-muted-foreground">{m.status === "confirmed" ? "✅ Lançamento registrado. Tabela, DRE e métricas atualizadas." : "❌ Lançamento cancelado."}</p>
                      ) : (
                        <div className="flex gap-2 pl-2">
                          <button className="rounded-full bg-action px-4 py-2 text-sm font-bold text-action-foreground" onClick={() => {
                            db.addTxs([m.pending!]);
                            db.updateMessages(threadId, (x) => x.map((y) => y.id === m.id ? { ...y, status: "confirmed" } : y));
                          }}>Confirmar e registrar</button>
                          <button className="rounded-full border border-border px-4 py-2 text-sm font-bold" onClick={() =>
                            db.updateMessages(threadId, (x) => x.map((y) => y.id === m.id ? { ...y, status: "cancelled" } : y))
                          }>Cancelar</button>
                        </div>
                      )
                    )}
                    {m.block === "finance" && (
                      <div className="space-y-3">
                        <div ref={idx === lastIdx ? financeRef : undefined}><FinanceTable txs={txs} /></div>
                        <ExportBar rows={financeRows()} name="finliy-controle-financeiro" target={financeRef} formats={idx === lastIdx ? ["csv", "xlsx", "png", "pdf"] : ["csv", "xlsx"]} />
                      </div>
                    )}
                    {m.block === "dre" && <DreReport m={metrics} />}
                    {m.block === "metrics" && <MetricsReport m={metrics} />}
                    {m.block === "chart" && m.chart && <ChartReport kind={m.chart} m={metrics} />}
                    {(m.text || m.block) && !(busy && idx === lastIdx) && idx > 0 && (
                      <div className="flex items-center gap-4 pl-2 text-sm font-bold">
                        <button onClick={() => redo(idx)} className="inline-flex items-center gap-1.5 hover:text-action">Refazer <RefreshCw className="size-4" /></button>
                        <button onClick={() => copy(m)} aria-label="Copiar" className="hover:text-action"><Copy className="size-4" /></button>
                      </div>
                    )}
                  </div>
                ),
              )}
              {busy && messages[lastIdx]?.role === "user" && typing}
              <div ref={endRef} />
            </div>
          </main>

          <div className="shrink-0 border-t border-border bg-card px-3 py-3 sm:px-8">
            <div className="mx-auto max-w-5xl space-y-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button onClick={() => setUploadOpen(true)} disabled={busy} title="Enviar arquivos (Excel, CSV, PDF, comprovantes)" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
                  <FileText className="size-5" /> Enviar arquivos
                </button>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={busy} className="shrink-0 rounded-full bg-muted px-4 py-2 text-xs font-semibold ring-1 ring-border hover:bg-accent disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="ESCREVA AQUI"
                  aria-label="Digite uma mensagem"
                  className="min-w-0 flex-1 bg-transparent py-2 text-base font-semibold text-primary-foreground outline-none placeholder:text-primary-foreground/50 sm:text-lg"
                />
                <button type="button" onClick={voice} aria-label="Falar" className={`grid size-10 place-items-center rounded-full text-primary-foreground ${listening ? "bg-expense" : "hover:bg-primary-foreground/10"}`}>
                  <Mic className="size-6" />
                </button>
                {aborter ? (
                  <button type="button" onClick={() => aborter.abort()} aria-label="Parar" className="grid size-10 place-items-center rounded-full bg-brand text-brand-foreground">
                    <Square className="size-4" />
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim() || busy} aria-label="Enviar" className="grid size-10 place-items-center rounded-full bg-brand text-brand-foreground disabled:opacity-40">
                    <SendHorizontal className="size-5" />
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>

      <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} onFiles={onFiles} />
    </div>
  );
}
