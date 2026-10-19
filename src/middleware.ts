import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  NO_ANALYTICS_COOKIE,
  NO_ANALYTICS_COOKIE_VALUE,
  NO_ANALYTICS_QUERY_PARAM,
  buildNoAnalyticsCookieOptions,
} from "@/lib/analytics-exclusion";
import { micrositeSlugFromHost } from "@/lib/microsite-host";

function withNoAnalyticsCookie(request: NextRequest, response: NextResponse) {
  response.cookies.set(
    NO_ANALYTICS_COOKIE,
    NO_ANALYTICS_COOKIE_VALUE,
    buildNoAnalyticsCookieOptions(request.nextUrl.hostname)
  );
  return response;
}

export function middleware(request: NextRequest) {
  const dropAnalytics =
    request.nextUrl.searchParams.get(NO_ANALYTICS_QUERY_PARAM) === "1";
  const slug = micrositeSlugFromHost(request.headers.get("host"));

  if (slug && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/a/${slug}`;
    if (dropAnalytics) url.searchParams.delete(NO_ANALYTICS_QUERY_PARAM);
    const response = NextResponse.rewrite(url);
    return dropAnalytics ? withNoAnalyticsCookie(request, response) : response;
  }

  if (!dropAnalytics) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.searchParams.delete(NO_ANALYTICS_QUERY_PARAM);
  return withNoAnalyticsCookie(request, NextResponse.redirect(url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
