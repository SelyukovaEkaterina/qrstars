import { redirectLegacyDashboard } from "@/lib/legacy-dashboard-redirect";

export default async function LegacyAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await redirectLegacyDashboard("stats", searchParams);
}
