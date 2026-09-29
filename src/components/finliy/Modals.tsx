import { useRef, useState } from "react";
import { CalendarDays, FileUp, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ACCEPTED_EXT, MAX_BYTES, brl, fmtSize, parseTransaction, todayISO, type Transaction, uid,
} from "@/lib/finliy";

/* ---------------- Cadastro Inteligente ---------------- */
export function SmartEntryModal({
  open, onOpenChange, onSave,
}: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (t: Transaction) => void }) {
  const [text, setText] = useState("");
  const [date, setDate] = useState(todayISO());
  const p = parseTransaction(text);
  const ready = !!(p.type && p.amount);

  const submit = () => {
    if (!ready) {
      toast.error("Não consegui identificar o tipo e o valor. Ex.: 'vendi 500 reais em produtos de pet'");
      return;
    }
    onSave({ id: uid(), date, description: p.description, category: p.category!, type: p.type!, amount: p.amount! });
    setText("");
    setDate(todayISO());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Cadastro Inteligente</DialogTitle>
          <DialogDescription className="sr-only">Descreva uma transação em uma frase</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-info p-4 text-sm text-info-foreground">
          <b>Como funciona:</b> Digite uma frase descritiva da transação e nossa IA identificará o tipo, valor e categoria automaticamente.
        </div>
        <div className="space-y-1.5">
          <label htmlFor="desc" className="text-sm font-semibold">Descrição da transação</label>
          <input
            id="desc"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="vendi 500 reais em produtos de pet"
            className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="data" className="text-sm font-semibold">Data da movimentação</label>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-input px-3 py-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              <input id="data" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-sm outline-none" />
            </div>
            <button onClick={() => setDate(todayISO())} className="rounded-xl bg-muted px-4 py-2 text-sm font-medium hover:bg-accent">Hoje</button>
          </div>
          <p className="text-xs text-muted-foreground">Data em que a movimentação ocorreu</p>
        </div>
        <div className="space-y-2.5 rounded-xl bg-muted p-4 ring-1 ring-border">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview da Transação</p>
          <Row label="Tipo:" value={p.type ?? "—"} tone={p.type === "Receita" ? "text-balance" : p.type === "Despesa" ? "text-expense" : ""} />
          <Row label="Categoria:" value={p.category ?? "—"} />
          <Row label="Valor estimado:" value={p.amount ? brl(p.amount) : "—"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onOpenChange(false)} className="rounded-xl border border-input py-3 text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button onClick={submit} disabled={!ready} className="rounded-xl bg-action py-3 text-sm font-semibold text-action-foreground transition hover:opacity-90 disabled:opacity-40">Processar</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

/* ---------------- Upload de arquivos ---------------- */
export function UploadModal({
  open, onOpenChange, onFiles,
}: { open: boolean; onOpenChange: (o: boolean) => void; onFiles: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list?.length) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ACCEPTED_EXT.includes(ext)) { toast.error(`"${f.name}": formato não suportado.`); continue; }
      if (f.size > MAX_BYTES) { toast.error(`"${f.name}" tem ${fmtSize(f.size)}. O máximo é 20MB.`); continue; }
      ok.push(f);
    }
    if (ok.length) { onFiles(ok); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Faça o upload do arquivo aqui</DialogTitle>
          <DialogDescription className="text-center">Aqui é onde acontecem os uploads de Excel, imagens e comprovantes</DialogDescription>
        </DialogHeader>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
          onClick={() => input.current?.click()}
          className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${drag ? "border-action bg-info" : "border-border bg-muted"}`}
        >
          <UploadCloud className="size-12 text-action" />
          <p className="mt-3 font-semibold">Arraste e solte o arquivo aqui ou clique para selecionar</p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            <FileUp className="size-4" /> Selecionar arquivo
          </span>
          <p className="mt-4 text-xs text-muted-foreground">Formatos suportados: PDF, DOC, DOCX, JPG, PNG, ZIP, XLSX</p>
          <p className="text-xs text-muted-foreground">Tamanho máximo: 20MB</p>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip,.xlsx"
            onChange={(e) => { handle(e.target.files); e.target.value = ""; }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Feedback ---------------- */
export function FeedbackModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [kind, setKind] = useState<"Sugestão" | "Erro">("Sugestão");
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");

  const send = () => {
    if (msg.trim().length < 5) { toast.error("Escreva um pouco mais sobre sua sugestão ou erro."); return; }
    const all = JSON.parse(localStorage.getItem("finliy:feedback") ?? "[]");
    all.push({ kind, msg: msg.trim(), email: email.trim(), at: new Date().toISOString() });
    localStorage.setItem("finliy:feedback", JSON.stringify(all));
    toast.success("Obrigado! Seu feedback foi enviado.");
    setMsg(""); setEmail(""); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Enviar Feedback</DialogTitle>
          <DialogDescription>Sugestões e erros nos ajudam a ajustar o FINLIY às necessidades reais da sua empresa.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(["Sugestão", "Erro"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`rounded-xl py-2.5 text-sm font-semibold transition ${kind === k ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}>
              {k === "Sugestão" ? "💡 Sugestão" : "🐛 Erro"}
            </button>
          ))}
        </div>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} placeholder="Conte o que aconteceu ou o que você gostaria de ver…" className="w-full rounded-xl border border-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Seu e-mail (opcional)" className="w-full rounded-xl border border-input px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <button onClick={send} className="w-full rounded-xl bg-brand py-3 font-bold text-brand-foreground hover:opacity-90">Enviar feedback</button>
      </DialogContent>
    </Dialog>
  );
}
