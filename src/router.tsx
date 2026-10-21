import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { IndexRoute } from "./routes/index";
import { ThreadRoute } from "./routes/c.$threadId";

const queryClient = new QueryClient();

const routeTree = rootRoute.addChildren([IndexRoute, ThreadRoute]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
