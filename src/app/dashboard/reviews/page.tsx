import { redirectLegacyDashboard } from "@/lib/legacy-dashboard-redirect";

export default async function LegacyReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = { ...sp, tab: "reviews" };
  await redirectLegacyDashboard("inbox", Promise.resolve(next));
}
