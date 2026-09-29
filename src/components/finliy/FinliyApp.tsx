import { useEffect, useRef, useState } from "react";
import {
  Copy, Download, FileText, IdCard, Menu, Mic, MessageSquareWarning, Plus, RefreshCw, SendHorizontal,
  Trash2, UserCircle2, X, Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import {
  type ChatMessage, type Plan, type RoutineItem, type Transaction,
  brl, fmtDate, fmtSize, isFinancialCommand, parseRoutineCommand, parseTransaction,
  seedNotes, seedRoutine, seedTransactions, todayISO, uid,
} from "@/lib/finliy";
import { FinanceTable, RoutineTable, withBalance } from "./Tables";
import { FeedbackModal, SmartEntryModal, UploadModal } from "./Modals";

const WELCOME: Record<Plan, ChatMessage[]> = {
  empresarial: [
    { id: "w1", role: "user", text: "Organize as informações que você já possui em uma tabela profissional, semelhante a uma planilha de Excel, com as colunas mais adequadas ao tema. Apresente apenas a tabela." },
    { id: "w2", role: "assistant", text: "Perfeito, aqui está a sua tabela", block: "finance" },
  ],
  pessoal: [
    { id: "w3", role: "user", text: "Organize as informações que você já possui em uma tabela de rotina, semelhante a uma planilha de Excel, com as colunas mais adequadas ao tema. Apresente apenas a tabela." },
    { id: "w4", role: "assistant", text: "Perfeito, aqui está a sua tabela de rotina.", block: "routine" },
  ],
};

const BLOCKED_TEXT =
  "Ops! 😊 O Plano Pessoal é focado na sua rotina e hábitos, por isso não computa vendas, compras ou movimentações financeiras. Para registrar entradas e saídas, alterne para o Plano Empresarial.";

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
  const [thinking, setThinking] = useState(false);
  const [menu, setMenu] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
  }, [messages.length, thinking, plan]);

  useEffect(() => { inputRef.current?.focus(); }, [plan, thinking]);

  const push = (p: Plan, ...m: ChatMessage[]) =>
    setChats((c) => ({ ...c, [p]: [...c[p], ...m] }));

  /* ---------- motor de respostas ---------- */
  function respond(text: string, p: Plan): ChatMessage {
    const t = text.toLowerCase();
    if (p === "pessoal") {
      if (isFinancialCommand(text)) return { id: uid(), role: "assistant", text: BLOCKED_TEXT, block: "blocked" };
      const item = parseRoutineCommand(text);
      if (item) {
        setRoutine((r) => [...r, { ...item, id: uid(), done: false }]);
        return { id: uid(), role: "assistant", text: `Pronto! Adicionei "${item.activity}" às ${item.time} (${item.duration}) na sua rotina.`, block: "routine" };
      }
      if (/(limpar|zerar|desmarcar)/.test(t)) {
        setRoutine((r) => r.map((i) => ({ ...i, done: false })));
        return { id: uid(), role: "assistant", text: "Desmarquei todas as atividades. Um novo dia começa! 🌅", block: "routine" };
      }
      if (/(rotina|tabela|habito|hábito|agenda|organiz|dia|mostr)/.test(t))
        return { id: uid(), role: "assistant", text: "Perfeito, aqui está a sua tabela de rotina.", block: "routine" };
      return { id: uid(), role: "assistant", text: 'Posso organizar sua rotina e hábitos. Experimente: "mostrar minha rotina", "adicionar 07:00 corrida 30 min" ou "desmarcar tudo".' };
    }
    // empresarial
    const parsed = parseTransaction(text);
    if (parsed.type && parsed.amount) {
      const tx: Transaction = { id: uid(), date: todayISO(), description: parsed.description, category: parsed.category!, type: parsed.type, amount: parsed.amount };
      setTxs((x) => [...x, tx]);
      return { id: uid(), role: "assistant", text: `Lançamento registrado: ${tx.type} de ${brl(tx.amount)} em "${tx.category}". Aqui está a sua tabela atualizada.`, block: "finance" };
    }
    if (/(saldo)/.test(t)) {
      const rows = withBalance(txs);
      const bal = rows[rows.length - 1]?.balance ?? 0;
      return { id: uid(), role: "assistant", text: `Seu saldo atual é ${brl(bal)}. Aqui está a sua tabela.`, block: "finance" };
    }
    if (/(tabela|planilha|relat|organiz|mostr|fluxo|caixa|resumo|entrada|saida|saída)/.test(t))
      return { id: uid(), role: "assistant", text: "Perfeito, aqui está a sua tabela", block: "finance" };
    return { id: uid(), role: "assistant", text: 'Não identifiquei um valor na sua mensagem. Tente: "vendi 500 reais em produtos de pet", "paguei 300 de energia" ou "mostrar tabela".' };
  }

  function send(text = input) {
    const v = text.trim();
    if (!v || thinking) return;
    const p = plan;
    push(p, { id: uid(), role: "user", text: v });
    setInput("");
    setThinking(true);
    setTimeout(() => {
      push(p, respond(v, p));
      setThinking(false);
    }, 650);
  }

  function redo(idx: number) {
    const prev = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user");
    if (!prev) return;
    setChats((c) => ({ ...c, [plan]: c[plan].filter((_, i) => i !== idx) }));
    setThinking(true);
    setTimeout(() => {
      const again = prev.text;
      // evita duplicar lançamento ao refazer: apenas regera a exibição
      const m: ChatMessage = plan === "empresarial" && parseTransaction(again).amount
        ? { id: uid(), role: "assistant", text: "Refeito! Aqui está a sua tabela atualizada.", block: "finance" }
        : respond(again, plan);
      push(plan, m);
      setThinking(false);
    }, 500);
  }

  function tableText(block: ChatMessage["block"], sep = "\t") {
    if (block === "finance") {
      const rows = withBalance(txs);
      const lines = [["Data", "Descrição", "Categoria", "Entrada (R$)", "Saída (R$)", "Saldo (R$)"].join(sep)];
      rows.forEach((r) => lines.push([fmtDate(r.date), r.description, r.category, r.type === "Receita" ? brl(r.amount) : "-", r.type === "Despesa" ? brl(r.amount) : "-", brl(r.balance)].join(sep)));
      const i = rows.filter((r) => r.type === "Receita").reduce((s, r) => s + r.amount, 0);
      const o = rows.filter((r) => r.type === "Despesa").reduce((s, r) => s + r.amount, 0);
      lines.push(["TOTAL", "", "", brl(i), brl(o), brl(i - o)].join(sep));
      return lines.join("\n");
    }
    if (block === "routine") {
      const lines = [["Horário", "Atividade", "Duração", "Concluído"].join(sep)];
      [...routine].sort((a, b) => a.time.localeCompare(b.time)).forEach((r) => lines.push([r.time, r.activity, r.duration, r.done ? "Sim" : "Não"].join(sep)));
      lines.push(`Notas${sep}${notes}`);
      return lines.join("\n");
    }
    return "";
  }

  function copy(m: ChatMessage) {
    navigator.clipboard.writeText(m.block === "finance" || m.block === "routine" ? tableText(m.block) : m.text);
    toast.success("Copiado! Cole direto no Excel.");
  }

  function download(block: ChatMessage["block"]) {
    const csv = "\uFEFF" + tableText(block, ";");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = block === "finance" ? "finliy-controle-financeiro.csv" : "finliy-tabela-de-rotina.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFiles(files: File[]) {
    files.forEach((f) => {
      push(plan,
        { id: uid(), role: "user", text: `📎 ${f.name}`, block: "file", file: { name: f.name, size: f.size } },
        { id: uid(), role: "assistant", text: `Recebi o arquivo "${f.name}" (${fmtSize(f.size)}). Ele ficou anexado a esta conversa. Na versão Beta, a leitura automática do conteúdo ainda está em testes — se quiser, descreva os lançamentos aqui no chat que eu organizo na tabela.` },
      );
    });
  }

  function onSmartSave(t: Transaction) {
    setTxs((x) => [...x, t]);
    push("empresarial",
      { id: uid(), role: "user", text: `✨ Cadastro Inteligente: ${t.description}` },
      { id: uid(), role: "assistant", text: `Lançamento registrado: ${t.type} de ${brl(t.amount)} em "${t.category}" (${fmtDate(t.date)}).`, block: "finance" },
    );
  }

  function openSmart() {
    if (plan === "pessoal") {
      push("pessoal", { id: uid(), role: "assistant", text: BLOCKED_TEXT, block: "blocked" });
      return;
    }
    setSmartOpen(true);
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
        { id: "empresarial", label: "PLANO EMPRESARIAL", sub: "Entradas, Saídas e Saldos", Icon: IdCard },
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

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Banner fixo Beta */}
      <div role="status" className="z-40 shrink-0 bg-warn px-4 py-2 text-center text-xs font-semibold text-warn-foreground sm:text-sm">
        ⚠️ Esta é uma versão Beta de validação (MVP) criada para testes. Pode conter pequenos erros. Por favor, deixe seu feedback para ajustarmos o app às necessidades reais da sua empresa!
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden w-72 shrink-0 border-r border-border bg-sidebar lg:block">{Sidebar}</aside>
        {/* Sidebar mobile */}
        {menu && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <aside className="w-72 bg-sidebar shadow-2xl">{Sidebar}</aside>
            <button className="flex-1 bg-foreground/40" onClick={() => setMenu(false)} aria-label="Fechar menu" />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Cabeçalho */}
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setMenu(true)} className="lg:hidden" aria-label="Abrir menu"><Menu className="size-7" /></button>
              <Logo className="lg:hidden" />
              <div className="hidden lg:block">
                <h1 className="text-lg font-extrabold">{plan === "pessoal" ? "Plano Pessoal" : "Plano Empresarial"}</h1>
                <p className="text-xs text-muted-foreground">{plan === "pessoal" ? "Sua rotina e hábitos organizados por IA" : "Gestão financeira de entradas, saídas e saldos por IA"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setFeedbackOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-foreground shadow-md ring-2 ring-foreground transition hover:-translate-y-0.5">
                <MessageSquareWarning className="size-4" /> Enviar Feedback
              </button>
              <UserCircle2 className="hidden size-9 sm:block" strokeWidth={1.5} aria-label="Perfil" />
            </div>
          </header>

          {/* Chat */}
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
                    {m.block === "finance" && <FinanceTable txs={txs} />}
                    {m.block === "routine" && (
                      <RoutineTable
                        items={routine}
                        notes={notes}
                        onNotes={setNotes}
                        onToggle={(id) => setRoutine((r) => r.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))}
                        onRemove={(id) => setRoutine((r) => r.filter((i) => i.id !== id))}
                      />
                    )}
                    {m.block === "blocked" ? (
                      <div className="max-w-xl rounded-3xl border-2 border-dashed border-warn bg-card p-4">
                        <p className="text-sm">{m.text}</p>
                        <button onClick={() => switchPlan("empresarial")} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                          Alternar para o Plano Empresarial →
                        </button>
                      </div>
                    ) : (
                      <div className="inline-block max-w-[90%] rounded-[2rem] bg-brand px-5 py-3.5 text-sm font-bold text-brand-foreground sm:max-w-[60%] sm:text-base">
                        {m.text}
                      </div>
                    )}
                    <div className="flex items-center gap-4 pl-2 text-sm font-bold">
                      <button onClick={() => redo(idx)} className="inline-flex items-center gap-1.5 hover:text-action">Refazer <RefreshCw className="size-4" /></button>
                      <button onClick={() => copy(m)} aria-label="Copiar" className="hover:text-action"><Copy className="size-4" /></button>
                      {(m.block === "finance" || m.block === "routine") && (
                        <button onClick={() => download(m.block)} aria-label="Baixar planilha" className="inline-flex items-center gap-1 hover:text-action"><Download className="size-4" /> <span className="font-normal">Baixar</span></button>
                      )}
                    </div>
                  </div>
                ),
              )}
              {thinking && (
                <div className="inline-flex gap-1.5 rounded-full bg-brand px-5 py-4" aria-label="FINLIY está pensando">
                  {[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-brand-foreground animate-blink" style={{ animationDelay: `${i * 0.2}s` }} />)}
                </div>
              )}
              <div ref={endRef} />
            </div>
          </main>

          {/* Composer */}
          <div className="shrink-0 border-t border-border bg-card px-3 py-3 sm:px-8">
            <div className="mx-auto max-w-5xl space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {plan === "empresarial" ? (
                  <button onClick={openSmart} title="Cadastro Inteligente" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground">
                    <Plus className="size-5" /> <span className="text-sm">Cadastro Inteligente</span>
                  </button>
                ) : (
                  <div className="rounded-full bg-muted px-4 py-2 text-xs text-muted-foreground">
                    🔒 Vendas e compras ficam no{" "}
                    <button onClick={() => switchPlan("empresarial")} className="font-bold text-action underline">Plano Empresarial</button>
                  </div>
                )}
                <button onClick={() => setUploadOpen(true)} title="Enviar arquivos" aria-label="Enviar arquivos" className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
                  <FileText className="size-5" />
                </button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="ESCREVA AQUI"
                  aria-label="Digite um comando"
                  className="min-w-0 flex-1 bg-transparent py-2 text-base font-semibold text-primary-foreground outline-none placeholder:text-primary-foreground/50 sm:text-lg"
                />
                <button type="button" onClick={voice} aria-label="Falar" className={`grid size-10 place-items-center rounded-full text-primary-foreground ${listening ? "bg-expense" : "hover:bg-primary-foreground/10"}`}>
                  <Mic className="size-6" />
                </button>
                <button type="submit" disabled={!input.trim() || thinking} aria-label="Enviar" className="grid size-10 place-items-center rounded-full bg-brand text-brand-foreground disabled:opacity-40">
                  <SendHorizontal className="size-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <SmartEntryModal open={smartOpen} onOpenChange={setSmartOpen} onSave={onSmartSave} />
      <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} onFiles={onFiles} />
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}
