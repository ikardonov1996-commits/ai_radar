import { NextRequest, NextResponse } from "next/server";

const ANON_COOKIE = "ar_anon";

// Every visitor gets an anonymous id cookie on first request. The client mirrors it
// into localStorage and restores the cookie from there if it gets cleared.
export function middleware(req: NextRequest) {
  if (req.cookies.get(ANON_COOKIE)?.value) return NextResponse.next();
  const id = crypto.randomUUID();
  req.cookies.set(ANON_COOKIE, id);
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set(ANON_COOKIE, id, { path: "/", maxAge: 400 * 86400, sameSite: "lax" });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
