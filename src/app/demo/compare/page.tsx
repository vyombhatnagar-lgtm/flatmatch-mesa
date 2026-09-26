import Link from "next/link";
import { CompareTable } from "@/components/results/compare-table";
import { DecisionFooter } from "@/components/results/bits";
import { PageHeader } from "@/components/ui";
import { getDemoResults } from "@/lib/demo/results";

export const metadata = { title: "Compare demo options" };
export const dynamic = "force-dynamic";

export default async function DemoCompare() {
  const data = await getDemoResults();
  return (
    <div>
      <Link href="/demo" className="text-sm text-accent underline underline-offset-2">← Back to options</Link>
      <div className="mt-4">
        <PageHeader eyebrow="Demo" title="Side by side">Same facts for each option, in the same order. Nothing is marked as the winner.</PageHeader>
      </div>
      <CompareTable options={data.shortlist} />
      <DecisionFooter />
    </div>
  );
}
