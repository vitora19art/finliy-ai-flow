import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Copy, FileText, IdCard, Menu, Mic, MessageSquareWarning, RefreshCw, SendHorizontal,
  Trash2, UserCircle2, X, Paperclip, Square,
} from "lucide-react";
import { toast } from "sonner";
import {
  type ChartKind, type ChatMessage, type Plan, type RoutineItem, type Transaction,
  brl, fmtDate, fmtSize, isTransactionMessage, parseRoutineCommand, parseTransaction,
  seedNotes, seedRoutine, seedTransactions, todayISO, uid,
} from "@/lib/finliy";
import { aiContext, computeMetrics } from "@/lib/metrics";
import { importTransactionsFromXlsx } from "@/lib/importXlsx";
import { FinanceTable, RoutineTable, withBalance } from "./Tables";
import { FeedbackModal, UploadModal } from "./Modals";
import { ChartReport, DreReport, ExportBar, MetricsReport } from "./Reports";

const WELCOME: Record<Plan, ChatMessage[]> = {
  empresarial: [
    { id: "w1", role: "assistant", text: "Olá! 👋 Sou o **FINLIY**, seu assistente de inteligência financeira. Converse comigo naturalmente: registre vendas e compras (ex.: *\"vendi 500 reais em produtos de pet\"*), peça a **DRE**, **métricas**, **gráficos** ou dicas para cortar custos e vender mais." },
    { id: "w2", role: "assistant", text: "Perfeito, aqui está a sua tabela", block: "finance" },
  ],
  pessoal: [
    { id: "w3", role: "assistant", text: "Olá! 🌿 Aqui no **Plano Pessoal** eu cuido da sua rotina e hábitos. Peça dicas de produtividade ou diga *\"adicionar 07:00 corrida 30 min\"*." },
    { id: "w4", role: "assistant", text: "Perfeito, aqui está a sua tabela de rotina.", block: "routine" },
  ],
};

const SUGGESTIONS: Record<Plan, string[]> = {
  empresarial: ["Mostre a tabela de DRE", "Gere um gráfico do faturamento por período", "Mostre as métricas financeiras", "Gráfico de pizza das despesas", "Como posso cortar custos?"],
  pessoal: ["Mostrar minha rotina", "Dicas para ter mais foco", "Adicionar 07:00 corrida 30 min", "Desmarcar tudo"],
};

const BLOCKED_TEXT =
  "Ops! 😊 O Plano Pessoal é focado na sua rotina e hábitos, por isso não computa vendas, compras ou movimentações financeiras. Para registrar entradas e saídas, alterne para o Plano Empresarial.";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function detectReport(text: string): Pick<ChatMessage, "block" | "chart" | "text"> | null {
  const t = norm(text);
  if (/grafico|chart|pizza|linha|barras/.test(t)) {
    let chart: ChartKind = "comparativo";
    if (/pizza|categoria/.test(t) || (/despesa/.test(t) && !/faturamento/.test(t))) chart = "despesas-pizza";
    else if (/saldo|evolu|linha/.test(t)) chart = "saldo-linha";
    else if (/margem|produto/.test(t)) chart = "margem-produto";
    else if (/compra|custo/.test(t) && !/faturamento|receita|venda/.test(t)) chart = "compras";
    else if (/faturamento|receita|venda/.test(t) && !/compra|x|versus|vs/.test(t)) chart = "faturamento";
    return { block: "chart", chart, text: "Aqui está o gráfico solicitado 📊" };
  }
  if (/\bdre\b|demonstrativo|resultado liquido/.test(t)) return { block: "dre", text: "Aqui está a sua DRE simplificada." };
  if (/metrica|indicador|kpi|ticket|cmv|margem|lucro bruto|faturamento total|receita bruta|custo de aquisicao|total de compras/.test(t))
    return { block: "metrics", text: "Aqui estão suas métricas financeiras." };
  if (/tabela|planilha|extrato|lancamentos|fluxo de caixa/.test(t)) return { block: "finance", text: "Perfeito, aqui está a sua tabela" };
  return null;
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
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

export default function FinliyApp() {
  const [hydrated, setHydrated] = useState(false);
  const [plan, setPlan] = useState<Plan>("empresarial");
  const [txs, setTxs] = useState<Transaction[]>(seedTransactions);
  const [routine, setRoutine] = useState<RoutineItem[]>(seedRoutine);
  const [notes, setNotes] = useState(seedNotes);
  const [chats, setChats] = useState<Record<Plan, ChatMessage[]>>(WELCOME);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const financeRef = useRef<HTMLDivElement>(null);
  const routineRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => computeMetrics(txs), [txs]);

  useEffect(() => {
    const ver = load("finliy:ver", 0);
    if (ver !== 2) {
      // nova versão: dados de exemplo com categorias/produtos para DRE e métricas
      localStorage.removeItem("finliy:txs");
      localStorage.removeItem("finliy:chats");
      localStorage.setItem("finliy:ver", "2");
    }
    setPlan(load("finliy:plan", "empresarial"));
    setTxs(load("finliy:txs", seedTransactions));
    setRoutine(load("finliy:routine", seedRoutine));
    setNotes(load("finliy:notes", seedNotes));
    setChats(load("finliy:chats", WELCOME));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("finliy:plan", JSON.stringify(plan));
    localStorage.setItem("finliy:txs", JSON.stringify(txs));
    localStorage.setItem("finliy:routine", JSON.stringify(routine));
    localStorage.setItem("finliy:notes", JSON.stringify(notes));
    localStorage.setItem("finliy:chats", JSON.stringify(chats));
  }, [hydrated, plan, txs, routine, notes, chats]);

  const messages = chats[plan];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, plan]);

  useEffect(() => { if (!busy) inputRef.current?.focus(); }, [plan, busy]);

  const push = (p: Plan, ...m: ChatMessage[]) =>
    setChats((c) => ({ ...c, [p]: [...c[p], ...m] }));
  const patch = (p: Plan, id: string, text: string) =>
    setChats((c) => ({ ...c, [p]: c[p].map((m) => (m.id === id ? { ...m, text } : m)) }));

  /* ---------- respostas locais (registro, relatórios, rotina) ---------- */
  function localResponse(text: string, p: Plan): ChatMessage | null {
    const t = norm(text);
    if (p === "pessoal") {
      if (isTransactionMessage(text)) return { id: uid(), role: "assistant", text: BLOCKED_TEXT, block: "blocked" };
      if (/\b(dre|faturamento|cmv|ticket medio|fluxo de caixa)\b/.test(t) || (/grafico/.test(t) && /(faturamento|compra|despesa|saldo|venda)/.test(t)))
        return { id: uid(), role: "assistant", text: BLOCKED_TEXT, block: "blocked" };
      const item = parseRoutineCommand(text);
      if (item && /(adicion|inclu|agend|coloc|marc)/.test(t)) {
        setRoutine((r) => [...r, { ...item, id: uid(), done: false }]);
        return { id: uid(), role: "assistant", text: `Pronto! Adicionei **${item.activity}** às ${item.time} (${item.duration}) na sua rotina. ✅`, block: "routine" };
      }
      if (/(desmarcar|zerar|limpar concl)/.test(t)) {
        setRoutine((r) => r.map((i) => ({ ...i, done: false })));
        return { id: uid(), role: "assistant", text: "Desmarquei todas as atividades. Um novo dia começa! 🌅", block: "routine" };
      }
      if (/(mostr|exib|ver|tabela).*(rotina)|minha rotina|tabela de rotina/.test(t))
        return { id: uid(), role: "assistant", text: "Perfeito, aqui está a sua tabela de rotina.", block: "routine" };
      return null;
    }
    if (isTransactionMessage(text)) {
      const pt = parseTransaction(text);
      const tx: Transaction = { id: uid(), date: todayISO(), description: pt.description, category: pt.category!, type: pt.type!, amount: pt.amount!, product: pt.product };
      setTxs((x) => [...x, tx]);
      const emoji = tx.type === "Receita" ? "💰" : "🧾";
      return {
        id: uid(), role: "assistant",
        text: `${emoji} Anotado! Registrei uma **${tx.type.toLowerCase()}** de **${brl(tx.amount)}** na categoria **${tx.category}**${tx.product ? ` (produto: ${tx.product})` : ""}, com data de hoje (${fmtDate(tx.date)}). Sua tabela já foi atualizada — quer ver a DRE ou um gráfico?`,
        block: "finance",
      };
    }
    const rep = detectReport(text);
    return rep ? { id: uid(), role: "assistant", ...rep } : null;
  }

  async function aiResponse(p: Plan, history: ChatMessage[]) {
    const id = uid();
    push(p, { id, role: "assistant", text: "" });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const context = p === "empresarial"
      ? aiContext(metrics, txs)
      : `Rotina (${routine.filter((r) => r.done).length}/${routine.length} concluídas):\n${routine.map((r) => `${r.time} ${r.activity} (${r.duration})${r.done ? " ✓" : ""}`).join("\n")}\nNotas: ${notes}`;
    const msgs = history
      .filter((m) => m.text && m.block !== "file")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.text.slice(0, 6000) }));
    let acc = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: p, context: context.slice(0, 8000), messages: msgs }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        patch(p, id, `⚠️ ${(await res.text().catch(() => "")) || "Não consegui responder agora. Tente novamente."}`);
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
            if (ev.type === "response.output_text.delta") { acc += ev.delta; patch(p, id, acc); }
            else if (ev.type === "error" || ev.type === "response.failed") {
              acc += "\n\n⚠️ A IA encontrou um problema ao responder.";
              patch(p, id, acc);
            }
          } catch { /* linha parcial */ }
        }
      }
      if (!acc) patch(p, id, "⚠️ Não recebi uma resposta. Tente reformular ou enviar novamente.");
    } catch (e) {
      if ((e as Error).name === "AbortError") patch(p, id, acc || "_(resposta interrompida)_");
      else patch(p, id, "⚠️ Falha de conexão com a IA. Tente novamente.");
    } finally {
      abortRef.current = null;
    }
  }

  async function run(text: string, p: Plan, history: ChatMessage[]) {
    setBusy(true);
    const local = localResponse(text, p);
    if (local) {
      await new Promise((r) => setTimeout(r, 400));
      push(p, local);
    } else {
      await aiResponse(p, history);
    }
    setBusy(false);
  }

  function send(text = input) {
    const v = text.trim();
    if (!v || busy) return;
    const p = plan;
    const userMsg: ChatMessage = { id: uid(), role: "user", text: v };
    push(p, userMsg);
    setInput("");
    run(v, p, [...messages, userMsg]);
  }

  function redo(idx: number) {
    if (busy) return;
    const before = messages.slice(0, idx);
    const prev = [...before].reverse().find((m) => m.role === "user");
    const target = messages[idx];
    if (!prev) {
      toast.info("Nada para refazer aqui.");
      return;
    }
    setChats((c) => ({ ...c, [plan]: c[plan].filter((_, i) => i !== idx) }));
    // não duplica lançamentos: ao refazer um registro, apenas mostra a tabela novamente
    if (plan === "empresarial" && isTransactionMessage(prev.text)) {
      push(plan, { id: uid(), role: "assistant", text: "Refeito! Aqui está a sua tabela atualizada.", block: "finance" });
      return;
    }
    if (target.block && target.block !== "blocked") {
      push(plan, { ...target, id: uid() });
      return;
    }
    run(prev.text, plan, before);
  }

  function copy(m: ChatMessage) {
    let text = m.text;
    if (m.block === "finance") {
      text = financeRows().map((r) => r.join("\t")).join("\n");
    } else if (m.block === "routine") {
      text = routineRows().map((r) => r.join("\t")).join("\n");
    }
    navigator.clipboard.writeText(text);
    toast.success("Copiado! Cole direto no Excel.");
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
  function routineRows(): (string | number)[][] {
    return [
      ["Horário", "Atividade", "Duração", "Concluído"],
      ...[...routine].sort((a, b) => a.time.localeCompare(b.time)).map((r) => [r.time, r.activity, r.duration, r.done ? "Sim" : "Não"]),
      [],
      ["Notas", notes],
    ];
  }

  async function onFiles(files: File[]) {
    const p = plan;
    for (const f of files) {
      push(p, { id: uid(), role: "user", text: `📎 ${f.name}`, block: "file", file: { name: f.name, size: f.size } });
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext === "xlsx") {
        if (p === "pessoal") {
          push(p, { id: uid(), role: "assistant", text: `Recebi a planilha "${f.name}". ${BLOCKED_TEXT}`, block: "blocked" });
          continue;
        }
        try {
          const imported = await importTransactionsFromXlsx(f);
          if (imported.length) {
            setTxs((x) => [...x, ...imported]);
            const inc = imported.filter((t) => t.type === "Receita").reduce((s, t) => s + t.amount, 0);
            const out = imported.filter((t) => t.type === "Despesa").reduce((s, t) => s + t.amount, 0);
            push(p, { id: uid(), role: "assistant", text: `📥 Importei **${imported.length} lançamentos** da planilha "${f.name}": ${brl(inc)} em entradas e ${brl(out)} em saídas. Tudo já está na sua tabela, DRE e métricas.`, block: "finance" });
          } else {
            push(p, { id: uid(), role: "assistant", text: `Recebi "${f.name}", mas não encontrei colunas reconhecíveis. Use cabeçalhos como **Data, Descrição, Categoria, Entrada (R$), Saída (R$)** ou **Valor** e **Tipo**.` });
          }
        } catch {
          push(p, { id: uid(), role: "assistant", text: `⚠️ Não consegui ler a planilha "${f.name}". Verifique se o arquivo não está corrompido ou protegido por senha.` });
        }
      } else {
        push(p, { id: uid(), role: "assistant", text: `Recebi o arquivo **"${f.name}"** (${fmtSize(f.size)}) e ele ficou anexado a esta conversa. Na versão Beta, a leitura automática de ${ext?.toUpperCase()} ainda está em testes — para lançar os valores automaticamente, envie uma planilha **.xlsx** ou descreva os lançamentos aqui no chat.` });
      }
    }
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

  function clearChat() {
    setChats((c) => ({ ...c, [plan]: WELCOME[plan] }));
    toast.success("Conversa reiniciada.");
  }

  function switchPlan(p: Plan) { setPlan(p); setMenu(false); }

  const Sidebar = (
    <nav className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <Logo />
        <button onClick={() => setMenu(false)} className="lg:hidden" aria-label="Fechar menu"><X /></button>
      </div>
      <p className="pt-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Planos</p>
      {([
        { id: "pessoal", label: "PLANO PESSOAL", sub: "Tabela de Rotina e Hábitos", Icon: UserCircle2 },
        { id: "empresarial", label: "PLANO EMPRESARIAL", sub: "Entradas, Saídas, Saldos e DRE", Icon: IdCard },
      ] as const).map(({ id, label, sub, Icon }) => {
        const active = plan === id;
        return (
          <button
            key={id}
            onClick={() => switchPlan(id)}
            aria-pressed={active}
            className={`flex flex-col items-center gap-2 rounded-3xl px-4 py-6 text-center transition ${active ? "bg-primary text-primary-foreground ring-4 ring-brand" : "bg-plan/25 text-foreground hover:bg-plan/40"}`}
          >
            <Icon className="size-14" strokeWidth={1.6} />
            <span className="text-base font-extrabold">{label}</span>
            <span className={`text-xs ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sub}</span>
          </button>
        );
      })}
      <div className="mt-auto space-y-2">
        <button onClick={clearChat} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
          <Trash2 className="size-4" /> Nova conversa neste plano
        </button>
      </div>
    </nav>
  );

  const lastIdx = messages.length - 1;

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
            <div className="flex items-center gap-3">
              <button onClick={() => setMenu(true)} className="lg:hidden" aria-label="Abrir menu"><Menu className="size-7" /></button>
              <Logo className="lg:hidden" />
              <div className="hidden lg:block">
                <h1 className="text-lg font-extrabold">{plan === "pessoal" ? "Plano Pessoal" : "Plano Empresarial"}</h1>
                <p className="text-xs text-muted-foreground">{plan === "pessoal" ? "Sua rotina e hábitos organizados por IA" : "Assistente de inteligência financeira e empresarial"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setFeedbackOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-foreground shadow-md ring-2 ring-foreground transition hover:-translate-y-0.5">
                <MessageSquareWarning className="size-4" /> Enviar Feedback
              </button>
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
                    {m.block === "blocked" ? (
                      <div className="max-w-xl rounded-3xl border-2 border-dashed border-warn bg-card p-4">
                        <p className="text-sm">{m.text}</p>
                        <button onClick={() => switchPlan("empresarial")} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                          Alternar para o Plano Empresarial →
                        </button>
                      </div>
                    ) : m.text ? (
                      <div className="prose prose-sm inline-block max-w-[90%] rounded-[2rem] bg-brand px-5 py-3.5 font-semibold text-brand-foreground sm:max-w-[70%] sm:text-base [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_strong]:font-extrabold">
                        <ReactMarkdown>{m.text}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="inline-flex gap-1.5 rounded-full bg-brand px-5 py-4" aria-label="FINLIY está pensando">
                        {[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-brand-foreground animate-blink" style={{ animationDelay: `${i * 0.2}s` }} />)}
                      </div>
                    )}
                    {m.block === "finance" && (
                      <div className="space-y-3">
                        <div ref={idx === lastIdx ? financeRef : undefined}><FinanceTable txs={txs} /></div>
                        <ExportBar rows={financeRows()} name="finliy-controle-financeiro" target={financeRef} formats={idx === lastIdx ? ["csv", "xlsx", "png", "pdf"] : ["csv", "xlsx"]} />
                      </div>
                    )}
                    {m.block === "routine" && (
                      <div className="space-y-3">
                        <div ref={idx === lastIdx ? routineRef : undefined}>
                          <RoutineTable
                            items={routine}
                            notes={notes}
                            onNotes={setNotes}
                            onToggle={(id) => setRoutine((r) => r.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))}
                            onRemove={(id) => setRoutine((r) => r.filter((i) => i.id !== id))}
                          />
                        </div>
                        <ExportBar rows={routineRows()} name="finliy-tabela-de-rotina" target={routineRef} formats={idx === lastIdx ? ["csv", "xlsx", "png", "pdf"] : ["csv", "xlsx"]} />
                      </div>
                    )}
                    {m.block === "dre" && <DreReport m={metrics} />}
                    {m.block === "metrics" && <MetricsReport m={metrics} />}
                    {m.block === "chart" && m.chart && <ChartReport kind={m.chart} m={metrics} />}
                    {(m.text || m.block) && !(busy && idx === lastIdx) && (
                      <div className="flex items-center gap-4 pl-2 text-sm font-bold">
                        <button onClick={() => redo(idx)} className="inline-flex items-center gap-1.5 hover:text-action">Refazer <RefreshCw className="size-4" /></button>
                        <button onClick={() => copy(m)} aria-label="Copiar" className="hover:text-action"><Copy className="size-4" /></button>
                      </div>
                    )}
                  </div>
                ),
              )}
              {busy && messages[lastIdx]?.role === "user" && (
                <div className="inline-flex gap-1.5 rounded-full bg-brand px-5 py-4" aria-label="FINLIY está pensando">
                  {[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-brand-foreground animate-blink" style={{ animationDelay: `${i * 0.2}s` }} />)}
                </div>
              )}
              <div ref={endRef} />
            </div>
          </main>

          <div className="shrink-0 border-t border-border bg-card px-3 py-3 sm:px-8">
            <div className="mx-auto max-w-5xl space-y-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button onClick={() => setUploadOpen(true)} title="Enviar arquivos" aria-label="Enviar arquivos" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <FileText className="size-5" />
                </button>
                {SUGGESTIONS[plan].map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={busy} className="shrink-0 rounded-full bg-muted px-4 py-2 text-xs font-semibold ring-1 ring-border hover:bg-accent disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
              {plan === "pessoal" && (
                <p className="text-xs text-muted-foreground">
                  🔒 Vendas e compras não são computadas aqui —{" "}
                  <button onClick={() => switchPlan("empresarial")} className="font-bold text-action underline">alternar para o Plano Empresarial</button>
                </p>
              )}
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
                {busy && abortRef.current ? (
                  <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Parar" className="grid size-10 place-items-center rounded-full bg-brand text-brand-foreground">
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
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}
