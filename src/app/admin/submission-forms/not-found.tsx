import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-color">
      <div className="text-center px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-secondary/10 border border-accent-secondary/20 mb-6">
          <FileText size={32} className="text-accent-secondary" />
        </div>
        <h1 className="text-3xl font-heading text-text-primary uppercase mb-2">
          Form Not Found
        </h1>
        <p className="text-text-secondary text-sm mb-6">
          The submission form you are looking for does not exist or has been
          removed.
        </p>
        <Link
          href="/admin/submission-forms"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all hover:opacity-90 shadow-[0_0_18px_rgba(255,0,127,0.28)]"
        >
          <ArrowLeft size={14} />
          <span>Back to Forms</span>
        </Link>
      </div>
    </div>
  );
}
