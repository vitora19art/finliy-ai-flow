import { useRef, useState } from "react";
import { FileUp, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ACCEPTED_EXT, MAX_BYTES, fmtSize,
} from "@/lib/finliy";

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
          <DialogDescription className="text-center">Aqui é onde acontecem os uploads de Excel, imagens e comprovantes. Planilhas, extratos em PDF e fotos de comprovantes são lidos e lançados automaticamente.</DialogDescription>
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
          <p className="mt-4 text-xs text-muted-foreground">Formatos suportados: PDF, DOC, DOCX, JPG, PNG, ZIP, XLSX, CSV</p>
          <p className="text-xs text-muted-foreground">Tamanho máximo: 20MB</p>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            accept=".csv,.pdf,.doc,.docx,.jpg,.jpeg,.png,.zip,.xlsx"
            onChange={(e) => { handle(e.target.files); e.target.value = ""; }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

