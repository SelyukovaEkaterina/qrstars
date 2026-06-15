import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { markCampaignsSent } from "@/lib/lifecycle-legacy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const emails = await prisma.userLifecycleEmail.findMany({
    where: { userId: id },
    orderBy: { sentAt: "asc" },
    select: { campaignKey: true, sentAt: true },
  });

  return NextResponse.json({ lifecycleEmails: emails });
}

/** Test-only: mark campaigns as sent for a user (simulates legacy backfill). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.E2E_TESTING !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { campaignKeys } = body as { campaignKeys?: string[] };

  if (!Array.isArray(campaignKeys)) {
    return NextResponse.json({ error: "campaignKeys required" }, { status: 400 });
  }

  await markCampaignsSent(id, campaignKeys);
  return NextResponse.json({ ok: true });
}
