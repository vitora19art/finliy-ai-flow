import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import ChatView from "@/components/finliy/ChatView";

export const Route = createFileRoute("/c/$threadId")({
  head: () => ({
    meta: [
      { title: "Chat — FINLIY" },
      { name: "description", content: "Converse com o assistente financeiro FINLIY: DRE, métricas, gráficos e leitura automática de arquivos." },
      { property: "og:title", content: "Chat — FINLIY" },
      { property: "og:description", content: "Converse com o assistente financeiro FINLIY: DRE, métricas, gráficos e leitura automática de arquivos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  return (
    <ClientOnly fallback={<div className="grid h-screen place-items-center text-sm text-muted-foreground">Carregando FINLIY…</div>}>
      <ChatView key={threadId} threadId={threadId} />
    </ClientOnly>
  );
}
