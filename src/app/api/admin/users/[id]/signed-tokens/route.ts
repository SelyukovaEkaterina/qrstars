import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createSignedFeedbackToken,
  createSignedUserToken,
  type UserTokenPurpose,
} from "@/lib/signed-user-token";
import { isFeedbackSurveyKind } from "@/lib/feedback-surveys";

/** Test-only: issue signed tokens for e2e (feedback / unsubscribe). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.E2E_TESTING !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const url = new URL(request.url);
  const purpose = url.searchParams.get("purpose") as UserTokenPurpose | null;
  const surveyKind = url.searchParams.get("surveyKind") ?? "d7";

  if (purpose === "feedback") {
    if (!isFeedbackSurveyKind(surveyKind)) {
      return NextResponse.json({ error: "Invalid surveyKind" }, { status: 400 });
    }
    const token = createSignedFeedbackToken(id, surveyKind);
    return NextResponse.json({ token, surveyKind });
  }

  if (purpose === "unsubscribe") {
    const token = createSignedUserToken(id, "unsubscribe");
    return NextResponse.json({ token });
  }

  return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
}
