// Voltti demo personas. POC-only mock identities — static seed data, no auth.
// Selection lives in localStorage (voltti.user.v1); "guest" is the signed-out
// default and is intentionally NOT a UserProfile. See docs/architecture.md.
//
// NOTE: this persona data ships in the client bundle. That's fine for a demo,
// but it is not a pattern to ship — real identity data must stay server-side.
import type { PersonaId, UserProfile } from "./types";

export const userProfiles: Record<Exclude<PersonaId, "guest">, UserProfile> = {
  elina: {
    id: "elina",
    name: "Elina Laine",
    email: "elina.laine@example.com",
    personaLabel: "New here · first visit",
    // No saved address and no orders — exercises empty states and the guided
    // novice path.
  },
  aino: {
    id: "aino",
    name: "Aino Virtanen",
    email: "aino.virtanen@example.com",
    personaLabel: "Returning builder · mid-PC-build",
    savedAddress: {
      fullName: "Aino Virtanen",
      email: "aino.virtanen@example.com",
      address: "Mannerheimintie 12 A 4",
      city: "Helsinki",
      postalCode: "00100",
      country: "Finland",
    },
    preferredPayment: "invoice",
  },
  sami: {
    id: "sami",
    name: "Sami Korhonen",
    email: "sami.korhonen@example.com",
    personaLabel: "Power user · long history",
    savedAddress: {
      fullName: "Sami Korhonen",
      email: "sami.korhonen@example.com",
      address: "Itämerenkatu 14",
      city: "Helsinki",
      postalCode: "00180",
      country: "Finland",
    },
    preferredPayment: "card",
  },
};

/** Personas in switcher display order. */
export const personaOrder: Exclude<PersonaId, "guest">[] = ["elina", "aino", "sami"];

export function getUserProfile(id: PersonaId): UserProfile | null {
  return id === "guest" ? null : userProfiles[id];
}

export function isPersonaId(value: string): value is PersonaId {
  return value === "guest" || value === "elina" || value === "aino" || value === "sami";
}
