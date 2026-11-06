import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/public-api/openapi";

/** Публичная спецификация, без ключа. */
export function GET() {
  return NextResponse.json(buildOpenApiSpec(), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
