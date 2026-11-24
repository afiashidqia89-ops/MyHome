import { NextRequest, NextResponse } from "next/server";

/**
 * CORS untuk klien APK luar origin: setelah "Set IP" di layar login,
 * WebView/browser memanggil server ini dari origin perangkat yang berbeda —
 * tanpa header ini fetch lintas origin diblokir browser. Autentikasi tetap
 * ditegakkan di tiap route (JWT Bearer + cookie), CORS hanya mengizinkan
 * transportnya.
 */
function corsHeaders(): Headers {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

export function middleware(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }
  const res = NextResponse.next();
  const h = corsHeaders();
  h.forEach((v, k) => res.headers.set(k, v));
  return res;
}

export const config = { matcher: "/api/:path*" };
