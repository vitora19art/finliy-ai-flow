import type { Transaction } from "./finliy";
import { todayISO, uid } from "./finliy";

const AI_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

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

const readDataUrl = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

export async function extractWithAI(
  file: File,
  text?: string,
  apiKey?: string,
): Promise<{ transactions: Transaction[]; summary: string }> {
  if (!apiKey) {
    return { transactions: [], summary: "Use planilhas Excel (.xlsx) ou CSV para importação automática. Para PDF e imagens, envie também uma planilha com os mesmos dados para garantir a leitura." };
  }

  const today = new Date().toISOString().slice(0, 10);
  const content: Record<string, unknown>[] = [
    {
      type: "input_text",
      text: `Extraia TODAS as movimentações financeiras do arquivo "${file.name}" (extrato, planilha, nota fiscal, recibo ou comprovante). Entradas/vendas/recebimentos = "Receita"; saídas/compras/pagamentos = "Despesa". amount sempre positivo em reais. Datas no formato YYYY-MM-DD (se não houver, use ${today}). Ignore linhas de TOTAL e subtotais. Classifique custos de mercadoria/insumos como "Compras" ou "Fornecedores". summary: 1 frase em português descrevendo o documento.`,
    },
  ];
  if (text) content.push({ type: "input_text", text: `CONTEÚDO:\n${text}` });
  else if (file.type.startsWith("image/")) {
    content.push({ type: "input_image", image_url: await readDataUrl(file) });
  } else {
    content.push({ type: "input_file", filename: file.name, file_data: await readDataUrl(file) });
  }

  let response: Response;
  try {
    response = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        input: [{ role: "user", content }],
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "extracao", strict: true, schema } },
      }),
    });
  } catch {
    throw new Error("Falha de conexão ao ler o arquivo. Tente novamente.");
  }

  if (!response.ok || !response.body) {
    let msg = "Não foi possível ler este arquivo agora. Tente novamente.";
    if (response.status === 429) msg = "Muitas solicitações. Tente em instantes.";
    throw new Error(msg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";
  let failed = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.type === "response.output_text.delta") output += ev.delta;
        if (ev.type === "error" || ev.type === "response.failed") failed = true;
      } catch {
        /* partial */
      }
    }
  }

  if (failed || !output) throw new Error("A IA não conseguiu ler este arquivo.");
  try {
    const data = JSON.parse(output);
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
  } catch {
    throw new Error("Resposta inválida da IA.");
  }
}
