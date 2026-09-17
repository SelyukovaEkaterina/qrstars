import { redirectLegacyDashboard } from "@/lib/legacy-dashboard-redirect";

export default async function LegacyMyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await redirectLegacyDashboard("page", searchParams);
}
