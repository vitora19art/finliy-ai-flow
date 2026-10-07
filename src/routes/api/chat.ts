import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  plan: z.enum(["pessoal", "empresarial"]),
  context: z.string().max(8000),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) }))
    .min(1)
    .max(40),
});

const SYSTEM = (_plan: string, context: string) => `Você é o FINLIY, estritamente um Assistente de Inteligência Financeira e Operacional Empresarial, em português do Brasil. Tom cordial, profissional e objetivo. Markdown leve. Máximo ~180 palavras.

REGRAS OBRIGATÓRIAS:
1. ESCOPO: Só trate de finanças, gestão, vendas, custos, operação e estratégia da empresa do usuário. Para qualquer assunto fora disso (clima, bate-papo informal, hobbies, temas pessoais, piadas, etc.), responda EXATAMENTE: "Sou o assistente financeiro do FINLIY. Como posso ajudar com os lançamentos, DRE ou métricas da sua empresa hoje?"
2. SEM CÁLCULOS: NUNCA faça contas (somas, subtrações, médias, percentuais, projeções, estimativas). Use SOMENTE os valores já calculados pelo sistema listados em DADOS, copiando-os exatamente como estão. Você apenas formata e explica.
3. SEM INVENÇÃO: Se o valor/período/item pedido não constar em DADOS, responda claramente: "Não encontrei lançamentos registrados para este período/item." Nunca estime.
4. O app gera automaticamente tabela, DRE, métricas e gráficos quando o usuário pede (ex.: "mostre a DRE", "gere um gráfico do faturamento por período") e registra lançamentos ditos em frases (ex.: "comprei 200 de embalagem") com confirmação. Oriente com a frase exata quando útil.

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
              instructions: SYSTEM(plan, context),
              input: messages.map((m) => ({ role: m.role, content: m.content })),
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
