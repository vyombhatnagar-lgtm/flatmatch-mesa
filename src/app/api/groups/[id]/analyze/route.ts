import { NextResponse } from "next/server";
import { z } from "zod";
import { AnalysisError, runGroupAnalysis } from "@/lib/analysis";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid group." }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const runId = await runGroupAnalysis(supabase, id);
    return NextResponse.json({ runId });
  } catch (e) {
    if (e instanceof AnalysisError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[analyze] unexpected error", e);
    return NextResponse.json({ error: "Something went wrong while comparing listings." }, { status: 500 });
  }
}
