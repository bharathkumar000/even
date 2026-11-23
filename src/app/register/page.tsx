import type { Metadata } from "next";
import RegisterClientView from "./register-client";
import { getCanonicalUrl } from "@/lib/seo-config";
import { getSemesterRegistrationCounts } from "@/app/actions/team-registration";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Team Registration · Ideathon Onboarding | Eventra",
  description: "Official team registration for Ideathon — Register your 4-member team and upload payment proof.",
  alternates: {
    canonical: getCanonicalUrl("/register"),
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RegisterPage() {
  const counts = await getSemesterRegistrationCounts();
  return <RegisterClientView initialCounts={counts} />;
}

