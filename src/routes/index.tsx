import { createFileRoute } from "@tanstack/react-router";
import FinliyApp from "@/components/finliy/FinliyApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FINLIY — Gestão financeira e de rotina com IA" },
      { name: "description", content: "Organize entradas, saídas, saldos e sua rotina diária conversando com a IA do FINLIY." },
      { property: "og:title", content: "FINLIY — Gestão financeira e de rotina com IA" },
      { property: "og:description", content: "Organize entradas, saídas, saldos e sua rotina diária conversando com a IA do FINLIY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinliyApp,
});
