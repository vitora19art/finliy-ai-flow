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

const SYSTEM = (plan: string, context: string) => `Você é o FINLIY, um Assistente Virtual de Inteligência Financeira e Empresarial (estilo ChatGPT), em português do Brasil.
Seja amigável, natural, consultivo e objetivo. Use markdown leve (listas curtas, negrito). Respostas de no máximo ~180 palavras, salvo se o usuário pedir mais.
Você dá dicas de finanças, estratégias de corte de custos, ideias para aumentar vendas e planejamento de rotina, sempre usando os dados reais do usuário abaixo quando fizer sentido.
Plano atual: ${plan === "pessoal" ? "PLANO PESSOAL (rotina e hábitos). Neste plano NÃO se registram vendas, compras ou movimentações financeiras; se o usuário quiser isso, sugira gentilmente alternar para o Plano Empresarial." : "PLANO EMPRESARIAL (gestão financeira)."}
O app já faz automaticamente: registrar transações ditas em frases (ex.: "vendi 500 reais em produtos de pet"), mostrar tabela financeira, DRE, métricas e gráficos (ex.: "gere um gráfico do faturamento por período", "mostre a DRE"), e importar planilhas .xlsx pelo botão de upload. Se o usuário pedir algo assim, oriente com a frase exata que ele pode digitar.
Nunca invente números além dos dados fornecidos.

DADOS ATUAIS DO USUÁRIO:
${context}`;

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
