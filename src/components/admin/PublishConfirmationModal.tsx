"use client";

import { useCallback } from "react";
import {
  Send,
  Eye,
  AlertCircle,
  ChevronRight,
  X,
} from "lucide-react";

interface PublishItem {
  id: string;
  title: string;
  type: string;
  currentStatus: string;
  visibility: string;
}

interface PublishConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onReview?: () => void;
  content?: PublishItem;
  isBulk?: boolean;
  items?: PublishItem[];
  loading?: boolean;
}

export function PublishConfirmationModal({
  open,
  onClose,
  onConfirm,
  onReview,
  content,
  isBulk = false,
  items = [],
  loading = false,
}: PublishConfirmationModalProps) {
  const handleConfirm = useCallback(async () => {
    await onConfirm();
  }, [onConfirm]);

  const handleReview = useCallback(() => {
    if (onReview) onReview();
    onClose();
  }, [onReview, onClose]);

  const displayItems = isBulk ? items : content ? [content] : [];

  return (
    open && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-confirm-title"
      >
        <div
          className="bg-[#0d0d14] border border-[#FF007F]/40 rounded-[24px] p-6 sm:p-8 w-full max-w-md animate-fade-in shadow-[0_0_40px_rgba(255,0,127,0.15)]"
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-[#FF007F]" />
            <h2
              id="publish-confirm-title"
              className="font-heading text-xl font-bold text-white uppercase tracking-wide m-0"
            >
              Confirm Publication
            </h2>
          </div>

          {/* Content info */}
          <div className="space-y-3 mb-6">
            {isBulk ? (
              <>
                <p className="text-xs text-[#a1a1aa] uppercase tracking-wider font-bold mb-2">
                  {items.length} item{items.length !== 1 ? "s" : ""} to publish
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 text-xs text-[#a1a1aa] leading-relaxed"
                    >
                      <span className="text-text-primary font-bold">{item.title}</span>
                      <span className="text-[#71717a]">({item.type})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-text-primary font-bold">{content?.title}</span>
                  <span className="text-[#71717a]">{content?.type}</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-[#a1a1aa]">
                  <span className="font-bold">Current status:</span>
                  <span>{content?.currentStatus}</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-[#a1a1aa]">
                  <span className="font-bold">Visibility:</span>
                  <span>{content?.visibility}</span>
                </div>
              </>
            )}
          </div>

          {/* Warning */}
          <div className="bg-[#FF007F]/10 border border-[#FF007F]/30 rounded-lg p-3 mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#FF007F] shrink-0 mt-0.5" />
              <p className="text-[10px] text-[#a1a1aa] leading-relaxed">
                Publishing will make this content visible to its intended audience.{" "}
                <span className="text-text-primary">This cannot be previewed after publish.</span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {onReview && (
              <button
                onClick={handleReview}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-3 border border-border-color rounded-[12px] text-[#a1a1aa] text-[10px] uppercase font-bold tracking-wider disabled:opacity-50 transition-colors hover:border-[#FF007F]/50 hover:text-white"
              >
                <Eye className="w-4 h-4 mr-1.5" />
                Review Before Publishing
              </button>
            )}
            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <button
                onClick={onClose}
                className="w-full px-4 py-3 border border-border-color rounded-[12px] text-[#a1a1aa] text-[10px] uppercase font-bold tracking-wider transition-colors hover:text-white hover:border-white/30"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full px-4 py-3 bg-[#FF007F] hover:bg-[#e60072] disabled:opacity-50 rounded-[12px] text-white text-[10px] uppercase font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(255,0,127,0.3)] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Confirm & Publish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  );
}
