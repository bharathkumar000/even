import { z } from "zod";

export const RoundSchema = z.object({
  title: z.string().min(1, "Title is required"),
  sequence_order: z.number().int().positive(),
  status: z.enum(["draft", "open", "closed", "locked", "reopened"]).default("draft"),
});

export const CriterionSchema = z.object({
  round_id: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  max_marks: z.number().positive("Max marks must be greater than 0"),
  is_required: z.boolean().default(true),
});

export const UpdateRoundStatusSchema = z.object({
  round_id: z.string().uuid(),
  status: z.enum(["draft", "open", "closed", "locked", "reopened"]),
});

export const UpdateCriterionSchema = CriterionSchema.partial().omit({ round_id: true });

export const EvaluationOverrideSchema = z.object({
  evaluation_id: z.string().uuid(),
  status: z.enum(["draft", "submitted", "locked", "reopened"]),
  reason: z.string().min(3, "Audit reason is required for evaluation override"),
});

export const ResultActionSchema = z.object({
  event_id: z.string().uuid(),
  action: z.enum(["recalculate", "publish", "lock"]),
  olympic: z.boolean().optional(),
});

