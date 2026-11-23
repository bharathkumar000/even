import { redirect } from "next/navigation";
import EventFlow from "./event-flow-client";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EventFlowPage() {
  const session = await getAuthenticatedUser();
  const user = session.user;

  if (!user) {
    redirect("/login");
  }

  return <EventFlow />;
}
