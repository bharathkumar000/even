"use client";

import React, { useState, useMemo } from "react";
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Lock,
  Unlock,
  Sliders,
  FileCheck2,
  Award,
} from "lucide-react";
import {
  createRound,
  updateRound,
  deleteRound,
  updateRoundStatus,
  createCriterion,
  updateCriterion,
  deleteCriterion,
  type RoundStatus,
} from "@/app/actions/admin-rounds";
import CustomSelect from "@/components/ui/CustomSelect";

const ROUND_STATUS_OPTIONS = [
  { value: "draft", label: "DRAFT", badge: "DRAFT", badgeColor: "bg-surface-color-light text-text-secondary border-border-color" },
  { value: "open", label: "OPEN (ACTIVE)", badge: "ACTIVE", badgeColor: "bg-accent-secondary/20 text-accent-secondary border-accent-secondary/40" },
  { value: "closed", label: "CLOSED", badge: "CLOSED", badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
  { value: "locked", label: "LOCKED", badge: "LOCKED", badgeColor: "bg-red-500/20 text-red-400 border-red-500/40" },
  { value: "reopened", label: "REOPENED", badge: "REOPEN", badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40" },
];

export interface AdminRoundItem {
  id: string;
  title: string;
  sequence_order: number;
  status: RoundStatus;
  event_id?: string;
}

export interface AdminCriterionItem {
  id: string;
  round_id: string;
  title: string;
  description?: string | null;
  max_marks: number;
  weightage?: number | null;
  is_required?: boolean;
}

const statusBadgeStyles: Record<
  RoundStatus,
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
  open: {
    label: "ACTIVE / OPEN",
    bg: "bg-status-success/10",
    border: "border-status-success/50",
    text: "text-status-success",
    dot: "bg-status-success animate-pulse",
  },
  draft: {
    label: "DRAFT",
    bg: "bg-surface-color-light",
    border: "border-border-color",
    text: "text-text-secondary",
    dot: "bg-text-secondary/60",
  },
  closed: {
    label: "CLOSED",
    bg: "bg-status-warning/10",
    border: "border-status-warning/40",
    text: "text-status-warning",
    dot: "bg-status-warning",
  },
  locked: {
    label: "LOCKED",
    bg: "bg-status-error/10",
    border: "border-status-error/40",
    text: "text-status-error",
    dot: "bg-status-error",
  },
  reopened: {
    label: "REOPENED",
    bg: "bg-accent-tertiary/15",
    border: "border-accent-tertiary/40",
    text: "text-accent-tertiary",
    dot: "bg-accent-tertiary animate-pulse",
  },
};

export default function RoundsClientView({
  initialRounds,
  initialCriteria,
}: {
  initialRounds: AdminRoundItem[];
  initialCriteria: AdminCriterionItem[];
}) {
  const [rounds, setRounds] = useState<AdminRoundItem[]>(
    [...initialRounds].sort((a, b) => a.sequence_order - b.sequence_order)
  );
  const [criteria, setCriteria] = useState<AdminCriterionItem[]>(initialCriteria);

  // Selected active round for inspector / tab view
  const [selectedRoundId, setSelectedRoundId] = useState<string>(
    rounds[0]?.id || ""
  );

  // Modals
  const [isRoundModalOpen, setIsRoundModalOpen] = useState(false);
  const [editingRound, setEditingRound] = useState<AdminRoundItem | null>(null);
  const [roundTitle, setRoundTitle] = useState("");
  const [roundOrder, setRoundOrder] = useState<number>(rounds.length + 1);
  const [roundStatus, setRoundStatus] = useState<RoundStatus>("draft");

  const [isCriterionModalOpen, setIsCriterionModalOpen] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<AdminCriterionItem | null>(null);
  const [criterionTitle, setCriterionTitle] = useState("");
  const [criterionDesc, setCriterionDesc] = useState("");
  const [criterionMaxMarks, setCriterionMaxMarks] = useState<number>(10);
  const [criterionRequired, setCriterionRequired] = useState(true);

  // Deletion Confirmation Modals
  const [roundToDelete, setRoundToDelete] = useState<AdminRoundItem | null>(null);
  const [criterionToDelete, setCriterionToDelete] = useState<AdminCriterionItem | null>(null);

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Active round object
  const activeRound = useMemo(
    () => rounds.find((r) => r.id === selectedRoundId) || null,
    [rounds, selectedRoundId]
  );

  // Criteria for active round
  const activeRoundCriteria = useMemo(
    () => criteria.filter((c) => c.round_id === selectedRoundId),
    [criteria, selectedRoundId]
  );

  // Total marks computation for active round
  const totalMaxMarks = useMemo(
    () => activeRoundCriteria.reduce((sum, c) => sum + (Number(c.max_marks) || 0), 0),
    [activeRoundCriteria]
  );

  // --- Handlers: Round CRUD ---
  const handleOpenCreateRound = () => {
    setEditingRound(null);
    setRoundTitle("");
    setRoundOrder(rounds.length + 1);
    setRoundStatus("draft");
    setIsRoundModalOpen(true);
  };

  const handleOpenEditRound = (round: AdminRoundItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRound(round);
    setRoundTitle(round.title);
    setRoundOrder(round.sequence_order);
    setRoundStatus(round.status);
    setIsRoundModalOpen(true);
  };

  const handleSaveRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roundTitle.trim()) return;

    const titleToSave = roundTitle.trim();
    const orderToSave = Number(roundOrder);
    const statusToSave = roundStatus;

    setIsRoundModalOpen(false);
    setNotification(null);

    if (editingRound) {
      const originalRound = editingRound;
      // Optimistic update
      setRounds((prev) =>
        prev
          .map((r) =>
            r.id === originalRound.id
              ? { ...r, title: titleToSave, sequence_order: orderToSave, status: statusToSave }
              : r
          )
          .sort((a, b) => a.sequence_order - b.sequence_order)
      );
      setNotification({
        type: "success",
        message: `Round "${titleToSave}" updated.`,
      });

      try {
        await updateRound(originalRound.id, {
          title: titleToSave,
          sequence_order: orderToSave,
          status: statusToSave,
        });
      } catch (err: unknown) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to save round.",
        });
      }
    } else {
      const tempId = crypto.randomUUID();
      const newObj: AdminRoundItem = {
        id: tempId,
        title: titleToSave,
        sequence_order: orderToSave,
        status: statusToSave,
      };

      // Optimistic update
      setRounds((prev) =>
        [...prev, newObj].sort((a, b) => a.sequence_order - b.sequence_order)
      );
      setSelectedRoundId(tempId);
      setNotification({
        type: "success",
        message: `Round "${titleToSave}" created.`,
      });

      try {
        const created = await createRound({
          title: titleToSave,
          sequence_order: orderToSave,
          status: statusToSave,
        });
        if (created?.id) {
          setRounds((prev) =>
            prev.map((r) => (r.id === tempId ? { ...r, id: created.id } : r))
          );
          setSelectedRoundId(created.id);
        }
      } catch (err: unknown) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to create round.",
        });
      }
    }
  };

  const handleDeleteRound = async () => {
    if (!roundToDelete) return;
    const target = roundToDelete;
    setRoundToDelete(null);

    // Optimistic delete
    setRounds((prev) => prev.filter((r) => r.id !== target.id));
    setCriteria((prev) => prev.filter((c) => c.round_id !== target.id));

    if (selectedRoundId === target.id) {
      const remaining = rounds.filter((r) => r.id !== target.id);
      setSelectedRoundId(remaining[0]?.id || "");
    }

    setNotification({
      type: "success",
      message: `Round "${target.title}" and its criteria deleted.`,
    });

    try {
      await deleteRound(target.id);
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete round.",
      });
    }
  };

  const handleStatusChange = async (roundId: string, nextStatus: RoundStatus) => {
    setRounds((prev) =>
      prev.map((r) => (r.id === roundId ? { ...r, status: nextStatus } : r))
    );

    try {
      await updateRoundStatus(roundId, nextStatus);
      setNotification({
        type: "success",
        message: `Status updated to ${nextStatus.toUpperCase()}.`,
      });
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update round status.",
      });
    }
  };

  // --- Handlers: Criteria CRUD ---
  const handleOpenCreateCriterion = () => {
    if (!activeRound) return;
    setEditingCriterion(null);
    setCriterionTitle("");
    setCriterionDesc("");
    setCriterionMaxMarks(10);
    setCriterionRequired(true);
    setIsCriterionModalOpen(true);
  };

  const handleOpenEditCriterion = (criterion: AdminCriterionItem) => {
    setEditingCriterion(criterion);
    setCriterionTitle(criterion.title);
    setCriterionDesc(criterion.description || "");
    setCriterionMaxMarks(criterion.max_marks);
    setCriterionRequired(criterion.is_required ?? true);
    setIsCriterionModalOpen(true);
  };

  const handleSaveCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoundId || !criterionTitle.trim()) return;

    const titleToSave = criterionTitle.trim();
    const descToSave = criterionDesc.trim() || undefined;
    const maxMarksToSave = Number(criterionMaxMarks);
    const requiredToSave = criterionRequired;

    setIsCriterionModalOpen(false);
    setNotification(null);

    if (editingCriterion) {
      const origId = editingCriterion.id;
      // Optimistic update
      setCriteria((prev) =>
        prev.map((c) =>
          c.id === origId
            ? {
                ...c,
                title: titleToSave,
                description: descToSave || null,
                max_marks: maxMarksToSave,
                is_required: requiredToSave,
              }
            : c
        )
      );
      setNotification({
        type: "success",
        message: `Criterion "${titleToSave}" updated.`,
      });

      try {
        await updateCriterion(origId, {
          title: titleToSave,
          description: descToSave,
          max_marks: maxMarksToSave,
          is_required: requiredToSave,
        });
      } catch (err: unknown) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to save criterion.",
        });
      }
    } else {
      const tempId = crypto.randomUUID();
      const newObj: AdminCriterionItem = {
        id: tempId,
        round_id: selectedRoundId,
        title: titleToSave,
        description: descToSave || null,
        max_marks: maxMarksToSave,
        is_required: requiredToSave,
      };

      // Optimistic add
      setCriteria((prev) => [...prev, newObj]);
      setNotification({
        type: "success",
        message: `Criterion "${titleToSave}" added.`,
      });

      try {
        const created = await createCriterion({
          round_id: selectedRoundId,
          title: titleToSave,
          description: descToSave,
          max_marks: maxMarksToSave,
          is_required: requiredToSave,
        });
        if (created?.id) {
          setCriteria((prev) =>
            prev.map((c) => (c.id === tempId ? { ...c, id: created.id } : c))
          );
        }
      } catch (err: unknown) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to save criterion.",
        });
      }
    }
  };

  const handleDeleteCriterion = async () => {
    if (!criterionToDelete) return;
    const target = criterionToDelete;
    setCriterionToDelete(null);

    // Optimistic delete
    setCriteria((prev) => prev.filter((c) => c.id !== target.id));
    setNotification({
      type: "success",
      message: `Criterion "${target.title}" deleted.`,
    });

    try {
      await deleteCriterion(target.id);
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete criterion.",
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-tech">
      {/* Top Single Header with Create Round Button */}
      <div className="border-b border-border-color pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-accent-secondary animate-pulse" />
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold m-0">
              Administration // Evaluation Scheme
            </p>
          </div>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0 flex items-center gap-3">
            <Layers className="w-8 h-8 md:w-10 md:h-10 text-accent-secondary" />
            Rounds & Criteria
          </h1>
          <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl m-0">
            Configure evaluation milestones, judging rubrics, maximum score bounds, and open/close progression stages in real-time.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleOpenCreateRound}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black font-tech font-bold uppercase tracking-wider text-xs transition-all hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.25)] cursor-pointer rounded"
          >
            <Plus size={16} />
            <span>Create Round</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 border flex items-center justify-between text-xs transition-all ${
            notification.type === "success"
              ? "bg-status-success/15 border-status-success text-status-success"
              : "bg-status-error/15 border-status-error text-status-error"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span className="font-bold tracking-wide">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-text-secondary hover:text-text-primary uppercase text-[10px] tracking-wider cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Dual-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Rounds Timeline / Progression (5 cols) */}
        <div className="lg:col-span-5 border border-border-color bg-surface-color/50 rounded-lg p-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-color/60">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-accent-secondary" />
              <h2 className="font-heading text-lg text-text-primary uppercase m-0">
                Evaluation Rounds ({rounds.length})
              </h2>
            </div>
          </div>

          {/* Rounds List */}
          <div className="space-y-3 overflow-y-auto max-h-[640px] pr-1">
            {rounds.length === 0 ? (
              <div className="p-8 text-center text-text-secondary text-xs">
                No evaluation rounds configured yet. Click &quot;Create Round&quot; above to begin.
              </div>
            ) : (
              rounds.map((round) => {
                const isSelected = round.id === selectedRoundId;
                const roundCriteriaList = criteria.filter((c) => c.round_id === round.id);
                const roundTotalMarks = roundCriteriaList.reduce(
                  (acc, c) => acc + (Number(c.max_marks) || 0),
                  0
                );
                const statusMeta = statusBadgeStyles[round.status] || statusBadgeStyles.draft;

                return (
                  <div
                    key={round.id}
                    onClick={() => setSelectedRoundId(round.id)}
                    className={`p-4 rounded border transition-all cursor-pointer relative group flex flex-col gap-3 overflow-hidden ${
                      isSelected
                        ? "bg-surface-color/80 border-accent-secondary/50 shadow-[0_0_15px_rgba(255,0,127,0.12)]"
                        : "bg-surface-color/40 border-border-color/70 hover:border-accent-secondary/40 hover:bg-surface-color"
                    }`}
                  >
                    {/* Ultra-subtle background tint layered to back */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-accent-secondary/[0.06] via-accent-secondary/[0.02] to-transparent pointer-events-none -z-0" />
                    )}

                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className="flex items-start gap-2.5">
                        <span className="px-2 py-0.5 bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary text-[10px] font-mono font-bold uppercase shrink-0 mt-0.5">
                          SEQ #{round.sequence_order}
                        </span>
                        <div>
                          <h3 className="font-heading text-base text-text-primary m-0 uppercase tracking-wide group-hover:text-accent-secondary transition-colors">
                            {round.title}
                          </h3>
                        </div>
                      </div>

                      {/* Status Dropdown */}
                      <div className="w-36 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <CustomSelect
                          value={round.status}
                          onChange={(val) =>
                            handleStatusChange(round.id, val as RoundStatus)
                          }
                          options={ROUND_STATUS_OPTIONS}
                          size="sm"
                          className="text-[10px] py-0.5 px-2 font-mono"
                        />
                      </div>
                    </div>

                    {/* Stats & Actions Row */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border-color/40 font-mono text-text-secondary">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-text-primary">
                          <Sliders size={13} className="text-accent-tertiary" />
                          {roundCriteriaList.length} Criteria
                        </span>
                        <span>•</span>
                        <span className="text-accent-primary font-bold">
                          Max {roundTotalMarks} Pts
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleOpenEditRound(round, e)}
                          className="p-1.5 hover:text-accent-tertiary text-text-secondary/70 transition-colors"
                          title="Edit Round Settings"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRoundToDelete(round);
                          }}
                          className="p-1.5 hover:text-status-error text-text-secondary/70 transition-colors"
                          title="Delete Round"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Criteria Rubric Builder (7 cols) */}
        <div className="lg:col-span-7 border border-border-color bg-surface-color/50 rounded-lg p-5 flex flex-col space-y-5">
          {activeRound ? (
            <>
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-color/60">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary font-bold">
                      Sequence #{activeRound.sequence_order}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 border font-bold ${
                        statusBadgeStyles[activeRound.status].bg
                      } ${statusBadgeStyles[activeRound.status].border} ${
                        statusBadgeStyles[activeRound.status].text
                      }`}
                    >
                      {statusBadgeStyles[activeRound.status].label}
                    </span>
                  </div>
                  <h2 className="font-heading text-xl md:text-2xl text-text-primary uppercase m-0 flex items-center gap-2">
                    {activeRound.title}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 bg-surface-color-light border border-border-color rounded text-right">
                    <p className="text-[10px] font-mono uppercase text-text-secondary m-0">Total Rubric</p>
                    <p className="font-heading text-base text-accent-primary m-0 font-bold">
                      {totalMaxMarks} PTS
                    </p>
                  </div>
                  <button
                    onClick={handleOpenCreateCriterion}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-black font-tech font-bold uppercase tracking-wider text-xs transition-all hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.25)] cursor-pointer rounded"
                  >
                    <Plus size={14} />
                    <span>Add Criterion</span>
                  </button>
                </div>
              </div>

              {/* Criteria Cards Grid */}
              <div className="space-y-3 overflow-y-auto max-h-[580px] pr-1">
                {activeRoundCriteria.length === 0 ? (
                  <div className="p-12 text-center text-text-secondary font-tech border border-dashed border-border-color/80 rounded-lg space-y-2">
                    <Award className="w-10 h-10 mx-auto text-text-secondary/40" />
                    <p className="text-sm uppercase font-bold text-text-primary m-0">
                      No Rubric Criteria Configured
                    </p>
                    <p className="text-xs text-text-secondary max-w-sm mx-auto">
                      Add criteria (e.g. Innovation, Technical Architecture, Pitch) so judges have a structured scorecard to evaluate teams.
                    </p>
                    <button
                      onClick={handleOpenCreateCriterion}
                      className="mt-3 px-4 py-1.5 border border-accent-tertiary text-accent-tertiary text-xs uppercase font-bold hover:bg-accent-tertiary/10 transition-colors"
                    >
                      + Add First Criterion
                    </button>
                  </div>
                ) : (
                  activeRoundCriteria.map((criterion, idx) => (
                    <div
                      key={criterion.id}
                      className="p-4 rounded border border-border-color/80 bg-surface-color/40 hover:bg-surface-color/70 hover:border-accent-primary/40 transition-all flex items-start justify-between gap-4 group"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono text-xs text-text-secondary/60">
                            #{idx + 1}
                          </span>
                          <h4 className="font-heading text-base text-text-primary uppercase tracking-wide m-0">
                            {criterion.title}
                          </h4>
                          <span className="font-mono text-xs px-2 py-0.5 bg-accent-primary/15 border border-accent-primary/40 text-accent-primary font-bold">
                            MAX: {criterion.max_marks} PTS
                          </span>
                          {criterion.is_required ? (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-status-error/15 border border-status-error/40 text-status-error font-bold uppercase">
                              REQUIRED
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-surface-color-light border border-border-color text-text-secondary uppercase">
                              OPTIONAL
                            </span>
                          )}
                        </div>

                        {criterion.description ? (
                          <p className="text-xs text-text-secondary font-mono leading-relaxed m-0">
                            {criterion.description}
                          </p>
                        ) : (
                          <p className="text-xs text-text-secondary/40 italic font-mono m-0">
                            No guideline description provided.
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          onClick={() => handleOpenEditCriterion(criterion)}
                          className="p-2 hover:text-accent-tertiary text-text-secondary/70 hover:bg-surface-color-light rounded transition-colors"
                          title="Edit Criterion"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setCriterionToDelete(criterion)}
                          className="p-2 hover:text-status-error text-text-secondary/70 hover:bg-status-error/10 rounded transition-colors"
                          title="Delete Criterion"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-text-secondary font-tech">
              Please select or create an evaluation round on the left to configure criteria.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create or Edit Round */}
      {isRoundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-border-color rounded-lg w-full max-w-md p-6 space-y-5 animate-fade-in shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <h3 className="font-heading text-lg text-text-primary uppercase m-0 flex items-center gap-2">
                <Layers className="w-5 h-5 text-accent-secondary" />
                {editingRound ? "Edit Evaluation Round" : "Create New Evaluation Round"}
              </h3>
              <button
                onClick={() => setIsRoundModalOpen(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRound} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">
                  Round Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Round 1: Innovation & Pitch"
                  value={roundTitle}
                  onChange={(e) => setRoundTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">
                    Sequence Order #
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={roundOrder}
                    onChange={(e) => setRoundOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">
                    Progression Status
                  </label>
                  <CustomSelect
                    value={roundStatus}
                    onChange={(val) => setRoundStatus(val as RoundStatus)}
                    options={ROUND_STATUS_OPTIONS}
                    size="md"
                    className="bg-surface-color-light"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRoundModalOpen(false)}
                  className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black text-xs uppercase font-bold tracking-wider rounded hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(255,0,127,0.3)]"
                >
                  {loading ? "Saving..." : editingRound ? "Update Round" : "Create Round"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create or Edit Criterion */}
      {isCriterionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-border-color rounded-lg w-full max-w-md p-6 space-y-5 animate-fade-in shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <h3 className="font-heading text-lg text-text-primary uppercase m-0 flex items-center gap-2">
                <Award className="w-5 h-5 text-accent-primary" />
                {editingCriterion ? "Edit Rubric Criterion" : "Add Rubric Criterion"}
              </h3>
              <button
                onClick={() => setIsCriterionModalOpen(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCriterion} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">
                  Criterion Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Technical Execution & Code Quality"
                  value={criterionTitle}
                  onChange={(e) => setCriterionTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-primary outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">
                  Scoring Rubric Description / Guidelines
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe evaluation benchmarks for judges..."
                  value={criterionDesc}
                  onChange={(e) => setCriterionDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-primary outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1">
                    Max Marks (Points)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={criterionMaxMarks}
                    onChange={(e) => setCriterionMaxMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-primary outline-none font-mono"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer select-none py-2 text-xs text-text-primary">
                    <input
                      type="checkbox"
                      checked={criterionRequired}
                      onChange={(e) => setCriterionRequired(e.target.checked)}
                      className="accent-accent-primary cursor-pointer w-4 h-4"
                    />
                    <span className="font-mono uppercase font-bold text-[11px]">
                      Mandatory Score
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCriterionModalOpen(false)}
                  className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-gradient-to-r from-accent-primary to-accent-tertiary text-black text-xs uppercase font-bold tracking-wider rounded hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                >
                  {loading ? "Saving..." : editingCriterion ? "Update Criterion" : "Add Criterion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Round Confirmation */}
      {roundToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-status-error/40 rounded-lg w-full max-w-sm p-6 space-y-4 animate-fade-in shadow-2xl">
            <h3 className="font-heading text-lg text-status-error uppercase m-0">
              Confirm Round Deletion
            </h3>
            <p className="text-xs text-text-secondary font-mono leading-relaxed">
              Are you sure you want to delete round{" "}
              <span className="text-text-primary font-bold">{roundToDelete.title}</span>? All
              its associated criteria rubric items will also be removed.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRoundToDelete(null)}
                className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRound}
                className="px-4 py-2 bg-status-error text-white text-xs uppercase font-bold rounded hover:bg-status-error/90 cursor-pointer"
              >
                Delete Round
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Criterion Confirmation */}
      {criterionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-status-error/40 rounded-lg w-full max-w-sm p-6 space-y-4 animate-fade-in shadow-2xl">
            <h3 className="font-heading text-lg text-status-error uppercase m-0">
              Confirm Criterion Deletion
            </h3>
            <p className="text-xs text-text-secondary font-mono leading-relaxed">
              Are you sure you want to remove rubric item{" "}
              <span className="text-text-primary font-bold">{criterionToDelete.title}</span>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCriterionToDelete(null)}
                className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCriterion}
                className="px-4 py-2 bg-status-error text-white text-xs uppercase font-bold rounded hover:bg-status-error/90 cursor-pointer"
              >
                Delete Criterion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
