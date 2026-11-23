import { redirect } from "next/navigation";
import EventDetails from "./event-details-client";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EventDetailsPage() {
  const session = await getAuthenticatedUser();
  const user = session.user;

  if (!user) {
    redirect("/login");
  }

  return <EventDetails />;
}
