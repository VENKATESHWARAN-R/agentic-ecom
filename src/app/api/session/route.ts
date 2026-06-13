// Mock-login surface for the BFF (Slice 1, P4). Selecting a persona establishes
// a server-side session (httpOnly signed cookie); the browser holds no identity
// of record. This replaces the old localStorage persona as the source of truth.
import { NextRequest, NextResponse } from "next/server";
import { clearSession, getSessionPersona, setSessionPersona } from "@/lib/session";
import { isPersonaId } from "@/lib/users";

/** Whoami — the current session persona. */
export async function GET() {
  const personaId = await getSessionPersona();
  return NextResponse.json({ personaId, signedIn: personaId !== "guest" });
}

/** Sign in as a persona (mock login). */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const personaId = (body as { personaId?: unknown }).personaId;
  if (typeof personaId !== "string" || !isPersonaId(personaId) || personaId === "guest") {
    return NextResponse.json({ error: "Unknown persona." }, { status: 400 });
  }
  await setSessionPersona(personaId);
  return NextResponse.json({ personaId, signedIn: true });
}

/** Sign out → guest. */
export async function DELETE() {
  await clearSession();
  return NextResponse.json({ personaId: "guest", signedIn: false });
}
