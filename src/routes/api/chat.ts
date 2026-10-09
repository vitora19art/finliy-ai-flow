import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  plan: z.enum(["pessoal", "empresarial"]),
  context: z.string().max(8000),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) }))
    .min(1)
    ,
});

const SYSTEM = (_plan: string, context: string) => `Você é o FINLIY, Assistente de Inteligência Financeira e Operacional Empresarial, em português do Brasil. Converse de forma amigável, fluida e consultiva, como um parceiro de negócios. Markdown leve. Máximo ~180 palavras.

REGRAS OBRIGATÓRIAS:
1. FOCO NO NEGÓCIO: Para assuntos pessoais ou fora do contexto empresarial, acolha ou converse brevemente de forma natural, sem inventar fatos, e em seguida pergunte: "Entendi! E qual a relação disso com o financeiro ou com as operações da sua empresa no momento?" ou "Como isso se relaciona com os custos ou planejamento do seu negócio?" Não use uma recusa rígida.
2. CÁLCULOS PERMITIDOS: Faça contas diretas, projeções e estimativas quando solicitado. Mostre base, fórmula, premissas e resultado. Exemplo: vender 10% a mais significa faturamento projetado = faturamento atual × 1,10 e incremento = faturamento atual × 0,10. Identifique claramente como projeção/estimativa, não como receita realizada. Nunca registre hipóteses como transações.
3. SEM INVENÇÃO: Valores históricos reais vêm dos DADOS. Se faltar uma base ou período, diga o que falta e peça a informação. Pode estimar apenas com premissas explícitas; não invente lançamentos nem assuma que um aumento em vendas implica o mesmo aumento de lucro.
4. O app registra transações diretas automaticamente (ex.: "comprei 300 em estoque"), somando à base financeira. Não peça confirmação novamente nem afirme que salvou algo fora desse fluxo. Upload de Excel, CSV, PDF e imagens é a principal entrada de dados e alimenta métricas, DRE e gráficos. A interface detecta pedidos de tabela, DRE, métricas e gráficos em linguagem natural e renderiza componentes interativos; por isso, não recrie esses relatórios em tabelas Markdown. Nunca use dados fictícios.

DADOS CALCULADOS PELO SISTEMA:
${context || "Nenhum lançamento registrado."}`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Requisição inválida", { status: 400 });
        const apiKey = process.env['LOVABLE_API_KEY'];
        if (!apiKey) return new Response("IA não configurada", { status: 500 });
        const { plan, context, messages } = parsed.data;
        try {
          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
            method: "POST",
            signal: request.signal,
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: "openai/gpt-6-astra",
               input: [{ role: "system", content: SYSTEM(plan, context) }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
              stream: true,
              store: false,
              reasoning: { effort: "low", summary: "auto" },
              include: ["reasoning.encrypted_content"],
            }),
          });
          if (!upstream.ok) {
            const txt = await upstream.text().catch(() => "");
            let msg = "A IA não conseguiu responder agora.";
            if (upstream.status === 429) msg = "Muitas solicitações em sequência. Aguarde alguns segundos e tente de novo.";
            if (upstream.status === 402) msg = "Os créditos de IA acabaram. Adicione créditos para continuar conversando.";
            console.error("AI gateway error", upstream.status, txt.slice(0, 300));
            return new Response(msg, { status: upstream.status });
          }
          const headers = new Headers({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
          upstream.headers.forEach((v, k) => {
            if (k.toLowerCase().startsWith("x-lovable-aig-")) headers.set(k, v);
          });
          return new Response(upstream.body, { status: 200, headers });
        } catch (e) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          console.error(e);
          return new Response("Falha ao contatar a IA.", { status: 502 });
        }
      },
    },
  },
});
