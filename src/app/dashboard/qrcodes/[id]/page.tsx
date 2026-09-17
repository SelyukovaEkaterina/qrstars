import { redirectLegacyDashboard } from "@/lib/legacy-dashboard-redirect";

export default async function LegacyQRCodeEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  await redirectLegacyDashboard("qrcodes", searchParams, id);
}
