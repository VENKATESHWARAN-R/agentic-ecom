import type { VisualKind } from "@/lib/types";

/**
 * Generated product illustration: a soft tinted tile with a stylized line
 * drawing of the device. Keeps the demo self-contained (no image assets).
 */
export function ProductVisual({ kind, accent, className }: { kind: VisualKind; accent: string; className?: string }) {
  return (
    <div
      className={`product-visual ${className ?? ""}`}
      style={{ background: `linear-gradient(140deg, ${accent}14, ${accent}2e)` }}
      aria-hidden
    >
      <svg viewBox="0 0 120 120" fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[kind]}
      </svg>
    </div>
  );
}

const ICONS: Record<VisualKind, React.ReactNode> = {
  phone: (
    <>
      <rect x="38" y="18" width="44" height="84" rx="10" />
      <line x1="52" y1="26" x2="68" y2="26" />
      <circle cx="60" cy="92" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  laptop: (
    <>
      <rect x="28" y="28" width="64" height="44" rx="4" />
      <path d="M20 86 L28 72 H92 L100 86 Z" />
      <line x1="48" y1="80" x2="72" y2="80" />
    </>
  ),
  desktop: (
    <>
      <rect x="34" y="16" width="52" height="88" rx="6" />
      <circle cx="60" cy="76" r="14" />
      <circle cx="60" cy="76" r="6" />
      <line x1="44" y1="28" x2="64" y2="28" />
      <circle cx="74" cy="28" r="2.5" fill="currentColor" stroke="none" />
    </>
  ),
  monitor: (
    <>
      <rect x="18" y="24" width="84" height="54" rx="5" />
      <line x1="60" y1="78" x2="60" y2="92" />
      <line x1="42" y1="96" x2="78" y2="96" />
    </>
  ),
  cpu: (
    <>
      <rect x="34" y="34" width="52" height="52" rx="6" />
      <rect x="48" y="48" width="24" height="24" rx="3" />
      {[44, 56, 68, 80].map((p) => (
        <g key={p}>
          <line x1={p} y1="24" x2={p} y2="34" />
          <line x1={p} y1="86" x2={p} y2="96" />
          <line x1="24" y1={p} x2="34" y2={p} />
          <line x1="86" y1={p} x2="96" y2={p} />
        </g>
      ))}
    </>
  ),
  gpu: (
    <>
      <rect x="16" y="38" width="88" height="38" rx="6" />
      <circle cx="44" cy="57" r="12" />
      <circle cx="78" cy="57" r="12" />
      <line x1="24" y1="84" x2="80" y2="84" />
      <line x1="28" y1="30" x2="44" y2="30" />
    </>
  ),
  motherboard: (
    <>
      <rect x="22" y="22" width="76" height="76" rx="5" />
      <rect x="34" y="34" width="26" height="26" rx="3" />
      <line x1="72" y1="34" x2="72" y2="60" />
      <line x1="82" y1="34" x2="82" y2="60" />
      <rect x="34" y="72" width="40" height="12" rx="2" />
      <circle cx="86" cy="80" r="4" />
    </>
  ),
  ram: (
    <>
      <rect x="22" y="42" width="76" height="30" rx="4" />
      {[34, 48, 62, 76].map((x) => (
        <rect key={x} x={x} y="50" width="9" height="13" rx="1.5" />
      ))}
      <line x1="26" y1="78" x2="94" y2="78" />
    </>
  ),
  storage: (
    <>
      <rect x="24" y="46" width="72" height="26" rx="5" />
      <circle cx="40" cy="59" r="5" />
      <line x1="56" y1="54" x2="86" y2="54" />
      <line x1="56" y1="64" x2="78" y2="64" />
    </>
  ),
  psu: (
    <>
      <rect x="26" y="34" width="68" height="52" rx="5" />
      <circle cx="52" cy="60" r="14" />
      <path d="M52 50 v10 l7 7" />
      <line x1="78" y1="48" x2="86" y2="48" />
      <line x1="78" y1="60" x2="86" y2="60" />
    </>
  ),
  case: (
    <>
      <rect x="36" y="16" width="48" height="88" rx="7" />
      <line x1="48" y1="30" x2="64" y2="30" />
      <circle cx="60" cy="68" r="13" />
      <path d="M60 55 a13 13 0 0 1 13 13" strokeOpacity="0.5" />
    </>
  ),
  cooler: (
    <>
      <circle cx="60" cy="60" r="32" />
      <circle cx="60" cy="60" r="7" />
      <path d="M60 53 q12 -14 2 -24 M67 60 q14 12 24 2 M60 67 q-12 14 -2 24 M53 60 q-14 -12 -24 -2" />
    </>
  ),
  headset: (
    <>
      <path d="M30 66 a30 30 0 0 1 60 0" />
      <rect x="24" y="62" width="14" height="24" rx="6" />
      <rect x="82" y="62" width="14" height="24" rx="6" />
      <path d="M89 86 q0 12 -18 12" />
    </>
  ),
  earbuds: (
    <>
      <path d="M42 38 a12 12 0 0 1 12 12 v6 a8 8 0 0 1 -16 0 v-22" />
      <path d="M78 38 a12 12 0 0 0 -12 12 v6 a8 8 0 0 0 16 0 v-22" />
      <line x1="42" y1="34" x2="42" y2="78" strokeOpacity="0.5" />
      <line x1="78" y1="34" x2="78" y2="78" strokeOpacity="0.5" />
    </>
  ),
  speaker: (
    <>
      <rect x="34" y="22" width="52" height="76" rx="10" />
      <circle cx="60" cy="44" r="9" />
      <circle cx="60" cy="76" r="14" />
      <circle cx="60" cy="76" r="5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="16" y="42" width="88" height="36" rx="6" />
      {[26, 40, 54, 68, 82].map((x) => (
        <rect key={x} x={x} y="50" width="10" height="9" rx="2" />
      ))}
      <rect x="38" y="64" width="44" height="7" rx="2" />
    </>
  ),
  mouse: (
    <>
      <rect x="40" y="26" width="40" height="68" rx="20" />
      <line x1="60" y1="26" x2="60" y2="50" />
      <line x1="60" y1="38" x2="60" y2="46" strokeWidth="5" />
    </>
  ),
  charger: (
    <>
      <rect x="34" y="30" width="52" height="60" rx="10" />
      <path d="M62 42 L50 64 h10 l-4 16 14 -24 h-10 z" />
      <line x1="48" y1="98" x2="48" y2="106" />
      <line x1="72" y1="98" x2="72" y2="106" />
    </>
  ),
  webcam: (
    <>
      <circle cx="60" cy="52" r="24" />
      <circle cx="60" cy="52" r="10" />
      <circle cx="60" cy="52" r="3" fill="currentColor" stroke="none" />
      <path d="M48 74 L44 94 h32 l-4 -20" />
    </>
  ),
  "smart-home": (
    <>
      <path d="M28 58 L60 30 L92 58" />
      <path d="M38 54 v36 h44 v-36" />
      <circle cx="60" cy="72" r="9" />
      <path d="M60 66 v6 l4 4" />
    </>
  ),
  "wifi-adapter": (
    <>
      <rect x="28" y="44" width="64" height="40" rx="5" />
      {[40, 52, 64, 76].map((x) => (
        <line key={x} x1={x} y1="84" x2={x} y2="92" />
      ))}
      <circle cx="60" cy="72" r="2.5" fill="currentColor" stroke="none" />
      <path d="M51 64 a13 13 0 0 1 18 0" />
      <path d="M44 56 a23 23 0 0 1 32 0" />
    </>
  ),
};
