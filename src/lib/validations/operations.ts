import { z } from "zod";
import { sanitizeText, limitedString, FIELD_LIMITS } from "@/lib/sanitize";

export const ActionTypeEnum = z.enum(["registration", "goodies", "lunch", "snacks"]);

export const ScanActionSchema = z.object({
  team_id: z.string().uuid("Invalid Team ID"),
  participant_id: z.string().uuid("Invalid Participant ID"),
  action_type: ActionTypeEnum,
});

export type ActionType = z.infer<typeof ActionTypeEnum>;
export type ScanActionInput = z.infer<typeof ScanActionSchema>;
