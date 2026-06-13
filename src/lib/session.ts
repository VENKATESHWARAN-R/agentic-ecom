// Server-side session for the BFF (Slice 1, P4). The browser never sets identity
// directly: a signed, httpOnly cookie holds the active persona, and every backend
// call carries a short-lived signed "identity assertion" the Python backend
// verifies. INTERNAL_JWT_SECRET stays server-side, so identity cannot be forged
// from the browser. Mock credential, real enforcement — this file is server-only.
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { PersonaId } from "./types";
import { isPersonaId } from "./users";

const SECRET = new TextEncoder().encode(
  process.env.INTERNAL_JWT_SECRET ?? "dev-only-insecure-internal-secret-change-me",
);
const SESSION_COOKIE = "voltti_session";
const SESSION_TTL = "7d";
const ASSERTION_TTL = "60s";

/** The active persona from the signed session cookie; "guest" if none/invalid. */
export async function getSessionPersona(): Promise<PersonaId> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return "guest";
  try {
    const { payload } = await jwtVerify(raw, SECRET, { algorithms: ["HS256"] });
    const sub = payload.sub;
    if (payload.typ === "session" && typeof sub === "string" && isPersonaId(sub)) {
      return sub;
    }
  } catch {
    // tampered or expired cookie → treat as guest
  }
  return "guest";
}

/** Establish a session for a persona (mock login). */
export async function setSessionPersona(personaId: Exclude<PersonaId, "guest">): Promise<void> {
  const token = await new SignJWT({ typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(personaId)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(SECRET);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** Clear the session (sign out → guest). */
export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * A short-lived signed assertion to attach to a backend call, or null for a
 * guest (no identity to assert). The backend trusts it because only the BFF
 * holds the secret. See backend security.py.
 */
export async function mintAssertion(personaId: PersonaId): Promise<string | null> {
  if (personaId === "guest") return null;
  return new SignJWT({ typ: "assertion" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(personaId)
    .setIssuedAt()
    .setExpirationTime(ASSERTION_TTL)
    .sign(SECRET);
}
