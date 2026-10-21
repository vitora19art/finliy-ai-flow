import { createRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { db, getDB } from "@/lib/store";
import { rootRoute } from "./__root";

export const IndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
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
