import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { FEEDBACK_SURVEY_CONFIG } from "@/lib/feedback-surveys";
import { verifySignedFeedbackToken } from "@/lib/signed-user-token";
import { notifyUserFeedback } from "@/lib/telegram-support";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const verified = verifySignedFeedbackToken(token);
  if (!verified) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const existing = await prisma.userFeedback.findUnique({
    where: {
      userId_surveyKind: { userId: verified.userId, surveyKind: verified.surveyKind },
    },
    select: { id: true },
  });

  return NextResponse.json({
    valid: true,
    surveyKind: verified.surveyKind,
    survey: FEEDBACK_SURVEY_CONFIG[verified.surveyKind],
    alreadySubmitted: !!existing,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { token, npsScore, comment, contactOk, contactPhone } = body as {
    token?: string;
    npsScore?: number;
    comment?: string;
    contactOk?: boolean;
    contactPhone?: string;
  };

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const verified = verifySignedFeedbackToken(token);
  if (!verified) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  if (typeof npsScore !== "number" || npsScore < 0 || npsScore > 10 || !Number.isInteger(npsScore)) {
    return NextResponse.json({ error: "NPS score must be an integer 0–10" }, { status: 400 });
  }

  const existing = await prisma.userFeedback.findUnique({
    where: {
      userId_surveyKind: { userId: verified.userId, surveyKind: verified.surveyKind },
    },
  });
  if (existing) {
    return NextResponse.json({ error: "Feedback already submitted" }, { status: 409 });
  }

  const user = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const trimmedComment = comment?.trim() || null;
  const trimmedPhone = contactOk && contactPhone?.trim() ? contactPhone.trim() : null;

  await prisma.userFeedback.create({
    data: {
      userId: verified.userId,
      surveyKind: verified.surveyKind,
      npsScore,
      comment: trimmedComment,
      contactOk: !!contactOk,
      contactPhone: trimmedPhone,
    },
  });

  void notifyUserFeedback({
    userId: user.id,
    email: user.email,
    name: user.name,
    surveyKind: verified.surveyKind,
    npsScore,
    comment: trimmedComment,
    contactOk: !!contactOk,
    contactPhone: trimmedPhone,
  }).catch((err) => console.error("notifyUserFeedback:", err));

  return NextResponse.json({ success: true, surveyKind: verified.surveyKind });
}
