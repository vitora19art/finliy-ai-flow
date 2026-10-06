import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { db, getDB } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FINLIY — Assistente de inteligência financeira com IA" },
      { name: "description", content: "Envie planilhas, extratos e comprovantes e converse com a IA do FINLIY para ver DRE, métricas e gráficos da sua empresa." },
      { property: "og:title", content: "FINLIY — Assistente de inteligência financeira com IA" },
      { property: "og:description", content: "Envie planilhas, extratos e comprovantes e converse com a IA do FINLIY para ver DRE, métricas e gráficos da sua empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    const latest = [...getDB().threads].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const id = latest?.id ?? db.createThread();
    navigate({ to: "/c/$threadId", params: { threadId: id }, replace: true });
  }, [navigate]);
  return <div className="grid h-screen place-items-center text-sm text-muted-foreground">Carregando FINLIY…</div>;
}
