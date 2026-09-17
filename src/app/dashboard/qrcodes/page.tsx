import { redirectLegacyDashboard } from "@/lib/legacy-dashboard-redirect";

export default async function LegacyQRCodesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await redirectLegacyDashboard("qrcodes", searchParams);
}
