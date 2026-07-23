import { SignJWT, jwtVerify } from "jose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "dev-secret");
const TOKEN_TTL_DAYS = 30;

export interface MobileTokenPayload {
  userId: string;
  email: string;
  role: string;
}

export async function signMobileToken(payload: MobileTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_DAYS}d`)
    .sign(secret);
}

export async function verifyMobileToken(token: string): Promise<MobileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string | undefined;
    const email = payload.email as string | undefined;
    const role = payload.role as string | undefined;
    if (!userId || !email) return null;
    return { userId, email, role: role ?? "USER" };
  } catch {
    return null;
  }
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Unified auth: checks Bearer JWT (mobile) first, falls back to NextAuth session (web).
 * Returns userId or null.
 */
export async function getAuthUserId(request: Request): Promise<string | null> {
  const bearer = extractBearerToken(request);
  if (bearer) {
    const payload = await verifyMobileToken(bearer);
    if (payload) return payload.userId;
  }
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return (session.user as Record<string, unknown>).id as string;
  }
  return null;
}

export async function getAuthUser(request: Request): Promise<MobileTokenPayload | null> {
  const bearer = extractBearerToken(request);
  if (bearer) {
    const payload = await verifyMobileToken(bearer);
    if (payload) return payload;
  }
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const u = session.user as Record<string, unknown>;
    return {
      userId: u.id as string,
      email: (u.email as string) ?? "",
      role: (u.role as string) ?? "USER",
    };
  }
  return null;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function withCorsHeaders<T>(response: NextResponse<T>): NextResponse<T> {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export function corsOkResponse(): NextResponse {
  return withCorsHeaders(NextResponse.json({ ok: true }));
}
