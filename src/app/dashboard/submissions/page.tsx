import { redirectLegacyDashboard } from "@/lib/legacy-dashboard-redirect";

export default async function LegacySubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = { ...sp, tab: "submissions" };
  await redirectLegacyDashboard("inbox", Promise.resolve(next));
}
