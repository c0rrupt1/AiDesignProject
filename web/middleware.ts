import { NextResponse, type NextRequest } from "next/server";

const CRM_HOST_CANDIDATES = [
  process.env.CRM_HOSTNAME,
  process.env.NEXT_PUBLIC_CRM_HOSTNAME,
]
  .filter(Boolean)
  .map((value) => value!.trim().toLowerCase())
  .filter((value) => value.length > 0);

const CRM_HOSTS = new Set(CRM_HOST_CANDIDATES);
const PRIMARY_MAIN_HOST =
  process.env.MAIN_HOSTNAME?.trim().toLowerCase() ?? null;

function isCrmHost(host: string): boolean {
  if (!host) {
    return false;
  }
  const normalized = host.toLowerCase();
  if (CRM_HOSTS.size === 0) {
    return normalized === "crm.deckd.us";
  }
  return CRM_HOSTS.has(normalized);
}

function isAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/public") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const pathname = request.nextUrl.pathname;

  if (isCrmHost(host)) {
    if (isAssetPath(pathname) || pathname.startsWith("/api")) {
      return NextResponse.next();
    }
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/crm";
      return NextResponse.redirect(url);
    }
    if (!pathname.startsWith("/crm")) {
      const url = request.nextUrl.clone();
      url.pathname = "/crm";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/crm") &&
    CRM_HOSTS.size > 0 &&
    !isAssetPath(pathname)
  ) {
    const redirectHost = Array.from(CRM_HOSTS)[0];
    const url = request.nextUrl.clone();
    url.hostname = redirectHost;
    if (PRIMARY_MAIN_HOST) {
      url.protocol = request.nextUrl.protocol;
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|static/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
