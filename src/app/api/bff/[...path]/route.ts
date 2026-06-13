// BFF proxy (Slice 1b, P4). The browser calls these same-origin routes; the Next
// server resolves the session persona, mints a short-lived signed identity
// assertion, and forwards the request to the backend with it attached. The
// browser never reaches the backend directly and cannot set the assertion (it is
// minted from the httpOnly session, server-side). Scoped: only ever forwards to
// <BACKEND_URL>/api/<path>. Per-route ownership enforcement lands in Slice 2.
import { NextRequest, NextResponse } from "next/server";
import { getSessionPersona, mintAssertion } from "@/lib/session";

const BACKEND_URL =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const persona = await getSessionPersona();
  const assertion = await mintAssertion(persona);

  const target = `${BACKEND_URL}/api/${path.join("/")}${req.nextUrl.search}`;
  const headers: Record<string, string> = {};
  if (assertion) headers.Authorization = `Bearer ${assertion}`;

  const init: RequestInit = { method: req.method, headers, cache: "no-store" };
  if (req.method !== "GET" && req.method !== "HEAD") {
    headers["Content-Type"] = req.headers.get("content-type") ?? "application/json";
    init.body = await req.text();
  }

  try {
    const res = await fetch(target, init);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "Backend unreachable." }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
