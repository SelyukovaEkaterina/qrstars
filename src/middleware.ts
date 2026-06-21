import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  NO_ANALYTICS_COOKIE,
  NO_ANALYTICS_COOKIE_VALUE,
  NO_ANALYTICS_QUERY_PARAM,
  buildNoAnalyticsCookieOptions,
} from "@/lib/analytics-exclusion";

export function middleware(request: NextRequest) {
  if (request.nextUrl.searchParams.get(NO_ANALYTICS_QUERY_PARAM) !== "1") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.searchParams.delete(NO_ANALYTICS_QUERY_PARAM);
  const response = NextResponse.redirect(url);

  response.cookies.set(
    NO_ANALYTICS_COOKIE,
    NO_ANALYTICS_COOKIE_VALUE,
    buildNoAnalyticsCookieOptions(request.nextUrl.hostname)
  );

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
