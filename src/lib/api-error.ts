import { NextResponse } from "next/server";

/** JSON error for API routes; in dev includes a hint for Prisma schema drift. */
export function apiErrorResponse(error: unknown, fallback = "Internal Server Error") {
  console.error(error);

  const message = error instanceof Error ? error.message : fallback;
  const prismaStale =
    /Cannot read properties of undefined \(reading '|supportTicket|Unknown field|does not exist/i.test(
      message
    );

  const hint =
    process.env.NODE_ENV !== "production" && prismaStale
      ? "Перезапустите dev-сервер (npm run dev) после prisma migrate / prisma generate."
      : undefined;

  return NextResponse.json(
    { error: fallback, ...(hint ? { hint } : {}), ...(process.env.NODE_ENV === "development" ? { detail: message } : {}) },
    { status: 500 }
  );
}
