// Voltti demo personas. POC-only mock identities — static seed data, no auth.
// The data lives in data/users.json — the single seed source shared with the
// Python backend. Selection lives in localStorage (voltti.user.v1); "guest" is
// the signed-out default and is intentionally NOT a UserProfile.
//
// NOTE: this persona data ships in the client bundle. That's fine for a demo,
// but it is not a pattern to ship — real identity data must stay server-side.
import usersData from "../../data/users.json";
import type { PersonaId, UserProfile } from "./types";

export const userProfiles = usersData as Record<Exclude<PersonaId, "guest">, UserProfile>;

/** Personas in switcher display order. */
export const personaOrder: Exclude<PersonaId, "guest">[] = ["elina", "aino", "sami"];

export function getUserProfile(id: PersonaId): UserProfile | null {
  return id === "guest" ? null : userProfiles[id];
}

export function isPersonaId(value: string): value is PersonaId {
  return value === "guest" || value === "elina" || value === "aino" || value === "sami";
}
