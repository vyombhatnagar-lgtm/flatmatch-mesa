import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { ListingEvaluation } from "@/lib/matching/types";
import { buildFallbackExplanation } from "./fallback";
import { ExplanationSchema, type ExplanationResult } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const TIMEOUT_MS = 20_000;

/** Words that would imply FlatMatch is picking a flat. Output containing them is rejected. */
const DECISION_LANGUAGE = /\b(we recommend|i recommend|recommended|best (option|choice|flat)|the winner|you should (choose|pick|go with)|clear choice)\b/i;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Compact, structured payload sent to Gemini. Contains no personal contact data. */
export function buildGeminiPayload(ev: ListingEvaluation) {
  return {
    property: {
      title: ev.property.title,
      locality: ev.property.locality,
      rent: ev.property.rent,
      bedrooms: ev.property.bedrooms,
      bathrooms: ev.property.bathrooms,
      floor: `${ev.property.floor}/${ev.property.totalFloors}`,
      lift: ev.property.lift,
      parking: ev.property.parking,
      furnishing: ev.property.furnishing,
      petFriendly: ev.property.petFriendly,
      balcony: ev.property.balcony,
      dataSource: ev.property.source === "mock" ? "mock listing (illustrative)" : "listing api",
    },
    commuteNote: ev.commuteIsEstimate ? "Commute minutes are approximate estimates, not live traffic." : "Live commute data.",
    groupCompatibility: ev.groupScore,
    participants: ev.participants.map((p) => ({
      name: p.name,
      fitScore: p.fitScore,
      rentShare: p.rentShare,
      mustHaves: `${p.mustHavesMet}/${p.mustHavesTotal} met`,
      satisfied: p.gets.map((g) => ({ requirement: g.label, priority: g.priority, detail: g.detail })),
      unmet: p.compromises.map((c) => ({ requirement: c.label, priority: c.priority, status: c.status, detail: c.detail })),
    })),
    satisfiedByEveryone: ev.satisfiedByEveryone.map((s) => s.label),
    severeCompromises: ev.severeCompromises.map((c) => `${c.name}: ${c.item.label} (${c.item.detail})`),
    ruleBasedDiscussionPoints: ev.discussionPoints,
  };
}

export function buildGeminiPrompt(ev: ListingEvaluation): string {
  return [
    "You are the explanation layer of FlatMatch, a decision-support tool for three people choosing a shared flat.",
    "A deterministic engine has ALREADY evaluated this listing. Do not re-score it, rank it, or change any facts.",
    "Task: Explain how this listing fits each participant and what trade-offs the group would need to discuss.",
    "Rules:",
    "- Never recommend, endorse or rank this flat. Never say it is the best, a winner, or that they should choose it.",
    "- Use only facts in the JSON. Do not invent amenities, distances or prices.",
    "- Mention that commute times are estimates when you cite them.",
    "- Be neutral, specific and brief: one or two sentences per field. Use the participants' names.",
    "- Discussion points must be open questions the group can talk through (e.g. 'Would Riya accept ...?').",
    "- Refer to people by name; avoid gendered pronouns.",
    "",
    "Evaluation JSON:",
    JSON.stringify(buildGeminiPayload(ev)),
  ].join("\n");
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    participants: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING }, fit: { type: Type.STRING } },
        required: ["name", "fit"],
      },
    },
    majorCompromises: { type: Type.ARRAY, items: { type: Type.STRING } },
    discussionPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["summary", "participants", "majorCompromises", "discussionPoints"],
};

type GenerateFn = (prompt: string) => Promise<string>;

function defaultGenerate(apiKey: string, model: string): GenerateFn {
  const ai = new GoogleGenAI({ apiKey });
  return async (prompt: string) => {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });
    return res.text ?? "";
  };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Explain one evaluated listing. Always resolves: on any problem it returns
 * the rule-based fallback and says why.
 */
export async function explainListing(
  ev: ListingEvaluation,
  opts: { apiKey?: string; model?: string; generate?: GenerateFn; timeoutMs?: number } = {},
): Promise<ExplanationResult> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  const model = opts.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const fallback = (reason: string): ExplanationResult => ({
    explanation: buildFallbackExplanation(ev),
    source: "fallback",
    model: null,
    fallbackReason: reason,
  });

  if (!opts.generate && !apiKey) return fallback("Gemini is not connected (GEMINI_API_KEY not set).");

  try {
    const generate = opts.generate ?? defaultGenerate(apiKey!, model);
    const prompt = buildGeminiPrompt(ev);
    let text = "";
    // Retry once on transient overload/rate-limit errors (503/429).
    for (let attempt = 0; ; attempt++) {
      try {
        text = await withTimeout(generate(prompt), opts.timeoutMs ?? TIMEOUT_MS);
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (attempt >= 1 || !/\b(503|429|UNAVAILABLE|RESOURCE_EXHAUSTED)\b/.test(msg)) throw e;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    const parsed = ExplanationSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return fallback("Gemini returned an unexpected format.");
    if (DECISION_LANGUAGE.test(JSON.stringify(parsed.data))) {
      return fallback("Gemini's wording implied a recommendation, so it was discarded.");
    }
    return { explanation: parsed.data, source: "gemini", model, fallbackReason: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gemini] explanation failed:", msg.slice(0, 300));
    return fallback("Gemini was unavailable, so a rule-based explanation is shown.");
  }
}
