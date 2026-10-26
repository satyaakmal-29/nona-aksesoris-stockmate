import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register", "/setup"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Biarkan aset, API, dan file statis lewat tanpa cek auth
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/assets") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isPublic  = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const sessionId = req.cookies.get("stockmate.sid")?.value;
  const isAuth    = Boolean(sessionId);

  // Belum login tapi akses halaman protected -> redirect ke login
  if (!isPublic && !isAuth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};