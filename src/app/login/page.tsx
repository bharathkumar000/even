import type { Metadata } from "next";
import AuthPage from "@/components/auth/AuthPage";
import { getCanonicalUrl } from "@/lib/seo-config";

export const metadata: Metadata = {
  title: "Login · Access Portal",
  description: "Unified Authentication Portal for Vice Verse 1.0 — Admin, Judges, Teams & Staff.",
  alternates: {
    canonical: getCanonicalUrl("/login"),
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

export default function LoginPage() {
  return <AuthPage isSignUp={false} />;
}
