import { z } from "zod";
import { sanitizeText, limitedString, requiredLimitedString, FIELD_LIMITS, SafeUrlSchema } from "@/lib/sanitize";

export const RoundSchema = z.object({
  title: requiredLimitedString(FIELD_LIMITS.title, "Title").transform(sanitizeText),
  sequence_order: z.number().int().positive(),
  status: z.enum(["draft", "open", "closed", "locked", "reopened"]).default("draft"),
});

export const CriterionSchema = z.object({
  round_id: z.string().uuid(),
  title: requiredLimitedString(FIELD_LIMITS.title, "Title").transform(sanitizeText),
  description: z.string().optional().transform((val) => val ? sanitizeText(val) : undefined),
  max_marks: z.number().positive("Max marks must be greater than 0").max(1000, "Max marks cannot exceed 1000"),
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
  reason: requiredLimitedString(FIELD_LIMITS.notes, "Reason").transform(sanitizeText),
});

export const ResultActionSchema = z.object({
  event_id: z.string().uuid(),
  action: z.enum(["recalculate", "publish", "lock"]),
  olympic: z.boolean().optional(),
});

