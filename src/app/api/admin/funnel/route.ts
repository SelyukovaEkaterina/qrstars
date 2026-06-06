import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSetupFunnelReport, resolveFunnelDateRange } from "@/lib/setup-funnel-admin";

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const range = resolveFunnelDateRange(
    searchParams.get("from"),
    searchParams.get("to")
  );

  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const report = await getSetupFunnelReport(range.from, range.to, range.toExclusive);
  return NextResponse.json(report);
}
