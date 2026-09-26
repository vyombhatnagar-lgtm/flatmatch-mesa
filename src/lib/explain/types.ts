import { z } from "zod";

export const ExplanationSchema = z.object({
  summary: z.string().min(1).max(600),
  participants: z
    .array(z.object({ name: z.string().min(1).max(60), fit: z.string().min(1).max(600) }))
    .min(1)
    .max(3),
  majorCompromises: z.array(z.string().min(1).max(400)).max(6),
  discussionPoints: z.array(z.string().min(1).max(400)).max(6),
});

export type Explanation = z.infer<typeof ExplanationSchema>;

export interface ExplanationResult {
  explanation: Explanation;
  source: "gemini" | "fallback";
  model: string | null;
  /** Why the fallback was used, if it was. Safe to show to users. */
  fallbackReason: string | null;
}
