import type { ExplanationResult } from "@/lib/explain/types";
import type { RunMeta } from "@/lib/groups";
import type { ListingEvaluation } from "@/lib/matching/types";

export interface ResultOption {
  evaluation: ListingEvaluation;
  explanation: ExplanationResult | null;
}

export interface ResultsData {
  mode: "demo" | "group";
  /** Base path for links, e.g. "/demo" or "/groups/<id>". */
  basePath: string;
  title: string;
  shortlist: ResultOption[];
  borderline: ListingEvaluation[];
  rejected: ListingEvaluation[];
  meta: RunMeta;
}

export const OPTION_LETTERS = ["A", "B", "C", "D", "E"];
