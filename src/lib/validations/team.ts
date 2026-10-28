import { z } from "zod";
import { sanitizeText, sanitizeUrl, requiredLimitedString, FIELD_LIMITS } from "@/lib/sanitize";

export const TeamSubmissionSchema = z.object({
  team_id: z.string().uuid(),
  round_id: z.string().uuid(),
  problem_statement: requiredLimitedString(FIELD_LIMITS.title, "Problem statement").transform(sanitizeText),
  problem_description: requiredLimitedString(FIELD_LIMITS.description, "Problem description").transform(sanitizeText),
  proposed_solution: requiredLimitedString(FIELD_LIMITS.description, "Proposed solution").transform(sanitizeText),
  solution_description: requiredLimitedString(FIELD_LIMITS.description, "Solution description").transform(sanitizeText),
  ppt_url: z.string().min(1, "A presentation file (PPT/PDF/DOCX) is required").transform(sanitizeUrl),
  github_url: z.string().url("Invalid GitHub URL").optional().or(z.literal("")).transform((value) => sanitizeUrl(value ?? "")),
  pitch_deck_url: z.string().url("Invalid Pitch Deck URL").optional().or(z.literal("")).transform((value) => sanitizeUrl(value ?? "")),
  prototype_url: z.string().url("Invalid Prototype URL").optional().or(z.literal("")).transform((value) => sanitizeUrl(value ?? "")),
  additional_material_url: z.string().url("Invalid Material URL").optional().or(z.literal("")).transform((value) => sanitizeUrl(value ?? "")),
});

export type TeamSubmissionInput = z.infer<typeof TeamSubmissionSchema>;
