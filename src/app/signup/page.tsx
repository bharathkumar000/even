import type { Metadata } from "next";
import AuthPage from "@/components/auth/AuthPage";
import { getCanonicalUrl } from "@/lib/seo-config";

export const metadata: Metadata = {
  title: "Register · Participant Onboarding",
  description: "Create an Account for Vice Verse 1.0 — Ideathon Squad Registration.",
  alternates: {
    canonical: getCanonicalUrl("/signup"),
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

export default function SignUpPage() {
  return <AuthPage isSignUp={true} />;
}
