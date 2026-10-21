import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  fileName: z.string().max(300),
  mime: z.string().max(120),
  dataUrl: z.string().max(28_000_000).optional(),
  text: z.string().max(200_000).optional(),
});

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["transactions", "summary"],
  properties: {
    summary: { type: "string" },
    transactions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "description", "category", "type", "amount", "product"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          description: { type: "string" },
          category: { type: "string", description: "Vendas, Serviços, Recebimentos, Compras, Fornecedores, Folha de Pagamento, Contas e Utilidades, Aluguel, Manutenção, Impostos, Marketing, Saldo inicial ou outra" },
          type: { type: "string", enum: ["Receita", "Despesa"] },
          amount: { type: "number" },
          product: { type: ["string", "null"], description: "Produto/linha de negócio associado, se houver" },
        },
      },
    },
  },
};

export const Route = createFileRoute("/api/extract")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Arquivo inválido ou grande demais." }, { status: 400 });
        const apiKey = process.env['LOVABLE_API_KEY'];
        if (!apiKey) return Response.json({ error: "IA não configurada" }, { status: 500 });
        const { fileName, mime, dataUrl, text } = parsed.data;
        const today = new Date().toISOString().slice(0, 10);
        const content: Record<string, unknown>[] = [
          {
            type: "input_text",
            text: `Extraia TODAS as movimentações financeiras do arquivo "${fileName}" (extrato, planilha, nota fiscal, recibo ou comprovante). Entradas/vendas/recebimentos = "Receita"; saídas/compras/pagamentos = "Despesa". amount sempre positivo em reais. Datas no formato YYYY-MM-DD (se não houver, use ${today}). Ignore linhas de TOTAL e subtotais. Classifique custos de mercadoria/insumos como "Compras" ou "Fornecedores". summary: 1 frase em português descrevendo o documento.`,
          },
        ];
        if (text) content.push({ type: "input_text", text: `CONTEÚDO:\n${text}` });
        else if (dataUrl && mime.startsWith("image/")) content.push({ type: "input_image", image_url: dataUrl });
        else if (dataUrl) content.push({ type: "input_file", filename: fileName, file_data: dataUrl });
        else return Response.json({ error: "Arquivo vazio." }, { status: 400 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          signal: request.signal,
          headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            input: [{ role: "user", content }],
            stream: true,
            store: false,
            reasoning: { effort: "low", summary: "auto" },
            include: ["reasoning.encrypted_content"],
            text: { format: { type: "json_schema", name: "extracao", strict: true, schema } },
          }),
        });
        if (!upstream.ok || !upstream.body) {
          const t = await upstream.text().catch(() => "");
          console.error("extract error", upstream.status, t.slice(0, 400));
          const msg = upstream.status === 429 ? "Muitas solicitações. Tente em instantes." : "Não foi possível ler este arquivo agora. Tente novamente.";
          return Response.json({ error: msg }, { status: upstream.status });
        }
        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        let buf = "", out = "", failed = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const l of lines) {
            if (!l.startsWith("data:")) continue;
            try {
              const ev = JSON.parse(l.slice(5).trim());
              if (ev.type === "response.output_text.delta") out += ev.delta;
              if (ev.type === "error" || ev.type === "response.failed") failed = true;
            } catch { /* parcial */ }
          }
        }
        if (failed || !out) return Response.json({ error: "A IA não conseguiu ler este arquivo." }, { status: 502 });
        try {
          return Response.json(JSON.parse(out));
        } catch {
          return Response.json({ error: "Resposta inválida da IA." }, { status: 502 });
        }
      },
    },
  },
});
