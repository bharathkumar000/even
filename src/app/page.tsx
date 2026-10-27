import type { Metadata } from "next";
import AuthPage from "@/components/auth/AuthPage";
import { getCanonicalUrl } from "@/lib/seo-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login · Access Portal | Eventra",
  description: "Unified Authentication Portal for Eventra 1.0 — Admin, Judges, Teams & Staff.",
  alternates: {
    canonical: getCanonicalUrl("/"),
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function HomePage() {
  return <AuthPage isSignUp={false} />;
}
