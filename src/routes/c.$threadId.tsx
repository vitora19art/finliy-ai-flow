import { createRoute } from "@tanstack/react-router";
import ChatView from "@/components/finliy/ChatView";
import { rootRoute } from "./__root";

export const ThreadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/c/$threadId",
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = ThreadRoute.useParams();
  return <ChatView key={threadId} threadId={threadId} />;
}
