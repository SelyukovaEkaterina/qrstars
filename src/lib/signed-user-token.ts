import crypto from "crypto";
import {
  type FeedbackSurveyKind,
  feedbackTokenTtlMs,
  isFeedbackSurveyKind,
} from "@/lib/feedback-surveys";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for signed tokens");
  return secret;
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export type UserTokenPurpose = "feedback" | "unsubscribe";

export function createSignedUserToken(
  userId: string,
  purpose: UserTokenPurpose,
  ttlMs: number = DEFAULT_TTL_MS
): string {
  const exp = Date.now() + ttlMs;
  const body = `${purpose}:${userId}:${exp}`;
  const sig = signPayload(body);
  return Buffer.from(`${body}:${sig}`).toString("base64url");
}

export function createSignedFeedbackToken(
  userId: string,
  surveyKind: FeedbackSurveyKind = "d7",
  ttlMs?: number
): string {
  const exp = Date.now() + (ttlMs ?? feedbackTokenTtlMs(surveyKind));
  const body = `feedback:${userId}:${surveyKind}:${exp}`;
  const sig = signPayload(body);
  return Buffer.from(`${body}:${sig}`).toString("base64url");
}

export function verifySignedUserToken(
  token: string,
  purpose: UserTokenPurpose
): { userId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon <= 0) return null;
    const body = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    if (signPayload(body) !== sig) return null;

    const [tokenPurpose, userId, expStr] = body.split(":");
    if (tokenPurpose !== purpose || !userId || !expStr) return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return null;

    return { userId };
  } catch {
    return null;
  }
}

export function verifySignedFeedbackToken(
  token: string
): { userId: string; surveyKind: FeedbackSurveyKind } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon <= 0) return null;
    const body = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    if (signPayload(body) !== sig) return null;

    const parts = body.split(":");
    if (parts[0] !== "feedback") return null;

    let userId: string;
    let surveyKind: FeedbackSurveyKind;
    let exp: number;

    if (parts.length === 3) {
      // legacy: feedback:userId:exp
      userId = parts[1];
      surveyKind = "d7";
      exp = Number(parts[2]);
    } else if (parts.length === 4 && isFeedbackSurveyKind(parts[2])) {
      userId = parts[1];
      surveyKind = parts[2];
      exp = Number(parts[3]);
    } else {
      return null;
    }

    if (!userId || !Number.isFinite(exp) || Date.now() > exp) return null;
    return { userId, surveyKind };
  } catch {
    return null;
  }
}

export function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "https://app.qrstars.ru").replace(/\/$/, "");
}
