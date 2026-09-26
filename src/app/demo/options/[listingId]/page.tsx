import { notFound } from "next/navigation";
import { OptionDetail } from "@/components/results/option-detail";
import { OPTION_LETTERS } from "@/components/results/types";
import { getDemoResults } from "@/lib/demo/results";

export const dynamic = "force-dynamic";

export default async function DemoOption({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const data = await getDemoResults();
  const idx = data.shortlist.findIndex((o) => o.evaluation.property.id === listingId);
  if (idx < 0) notFound();
  return <OptionDetail option={data.shortlist[idx]} letter={OPTION_LETTERS[idx]} basePath="/demo" />;
}
