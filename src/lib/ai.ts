import type { ChatMessage } from "./finliy";

const AI_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

function systemPrompt(context: string): string {
  return `Você é o FINLIY, Assistente de Inteligência Financeira e Operacional Empresarial, em português do Brasil. Converse de forma amigável, fluida e consultiva, como um parceiro de negócios. Markdown leve. Máximo ~180 palavras.

REGRAS OBRIGATÓRIAS:
1. FOCO NO NEGÓCIO: Para assuntos pessoais ou fora do contexto empresarial, acolha ou converse brevemente de forma natural, sem inventar fatos, e em seguida pergunte: "Entendi! E qual a relação disso com o financeiro ou com as operações da sua empresa no momento?" ou "Como isso se relaciona com os custos ou planejamento do seu negócio?" Não use uma recusa rígida.
2. CÁLCULOS PERMITIDOS: Faça contas diretas, projeções e estimativas quando solicitado. Mostre base, fórmula, premissas e resultado. Exemplo: vender 10% a mais significa faturamento projetado = faturamento atual × 1,10 e incremento = faturamento atual × 0,10. Identifique claramente como projeção/estimativa, não como receita realizada. Nunca registre hipóteses como transações.
3. SEM INVENÇÃO: Valores históricos reais vêm dos DADOS. Se faltar uma base ou período, diga o que falta e peça a informação. Pode estimar apenas com premissas explícitas; não invente lançamentos nem assuma que um aumento em vendas implica o mesmo aumento de lucro.
4. PROIBIDO escrever tabelas, DRE, listas de métricas ou gráficos em texto/Markdown (nada de "|" ou colunas). Relatórios aparecem só nos componentes visuais da interface; se o usuário pedir um, oriente a pedir com "mostre o DRE", "gere o gráfico de faturamento", "mostre as métricas" ou usar os atalhos.
5. O app registra transações diretas automaticamente (ex.: "comprei 300 em estoque"), somando à base financeira. Não peça confirmação novamente nem afirme que salvou algo fora desse fluxo. Upload de Excel, CSV, PDF e imagens é a principal entrada de dados e alimenta métricas, DRE e gráficos. Nunca use dados fictícios.

DADOS CALCULADOS PELO SISTEMA:
${context || "Nenhum lançamento registrado."}`;
}

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export async function* streamChat(
  context: string,
  messages: { role: "user" | "assistant"; content: string }[],
  apiKey: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  if (!apiKey) {
    yield { type: "error", message: "IA não configurada. Os relatórios (DRE, métricas, gráficos e tabelas) continuam disponíveis pelos atalhos e comandos do chat." };
    return;
  }

  let response: Response;
  try {
    response = await fetch(AI_URL, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: systemPrompt(context) },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
      }),
    });
  } catch {
    if (signal?.aborted) return;
    yield { type: "error", message: "Falha de conexão com a IA. Tente novamente." };
    return;
  }

  if (!response.ok || !response.body) {
    let msg = "A IA não conseguiu responder agora. Tente novamente em instantes.";
    if (response.status === 429) msg = "Muitas solicitações em sequência. Aguarde alguns segundos e tente de novo.";
    yield { type: "error", message: msg };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") {
          yield { type: "delta", text: ev.delta };
        } else if (ev.type === "error" || ev.type === "response.failed") {
          yield { type: "error", message: "A IA encontrou um problema ao responder." };
        }
      } catch {
        /* partial */
      }
    }
  }
  yield { type: "done" };
}

export type { ChatMessage };
