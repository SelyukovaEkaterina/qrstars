import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireDbUserId } from "@/lib/session-user";
import { PRO_TRIAL_DAYS, getProTrialState, startProTrial } from "@/lib/pro-trial";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as Record<string, unknown>).id as string;
  const state = await getProTrialState(userId);
  return NextResponse.json({ ...state, days: PRO_TRIAL_DAYS });
}

export async function POST() {
  const auth = await requireDbUserId();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await startProTrial(auth.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    plan: "PRO",
    days: PRO_TRIAL_DAYS,
    endsAt: result.endsAt.toISOString(),
  });
}
