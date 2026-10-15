import clsx from "clsx";

/**
 * A line drawing in the logo's style, standing in for a photo of a holiday home:
 * a cottage among the pines for the forest, or a clifftop apartment for the coast.
 */
export function HomeIllustration({ setting, className }: { setting: "forest" | "coast"; className?: string }) {
  return (
    <svg
      viewBox="0 0 400 240"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx("text-forest", className)}
    >
      {setting === "forest" ? (
        <>
          <g stroke="var(--color-sage)" strokeWidth="4">
            <path d="M14 118 C 110 84, 210 78, 300 86 S 370 104, 388 100" />
            <path d="M14 214 Q 200 198 388 214" />
          </g>
          <g stroke="currentColor" strokeWidth="4.5">
            <path d="M64 212 V98 M40 150 L64 98 L88 150 M46 178 L64 132 L82 178" />
            <path d="M114 214 V124 M94 166 L114 124 L134 166 M100 190 L114 156 L128 190" />
            <path d="M196 160 L262 100 L328 160 M206 158 L262 112 L318 158" />
            <path d="M206 158 V210 H318 V158" />
            <path d="M250 210 V180 H274 V210" />
            <rect x="218" y="170" width="20" height="18" rx="1.5" />
            <rect x="286" y="170" width="20" height="18" rx="1.5" />
            <path d="M352 212 V132 M336 172 L352 132 L368 172 M340 194 L352 162 L364 194" />
          </g>
        </>
      ) : (
        <>
          <g stroke="var(--color-sage)" strokeWidth="4">
            <circle cx="318" cy="70" r="20" />
            <path d="M262 168 L286 156 L304 166 M316 168 L330 160 L344 168" />
            <path d="M198 196 q 16 -9 32 0 t 32 0 t 32 0 t 32 0 t 32 0 t 32 0" />
            <path d="M214 218 q 16 -9 32 0 t 32 0 t 32 0 t 32 0 t 32 0" />
          </g>
          <g stroke="currentColor" strokeWidth="4.5">
            <path d="M12 150 H150 Q 172 150 180 176 L 190 214" />
            <path d="M34 150 V82 H132 V150" />
            <path d="M28 82 H138" />
            <rect x="48" y="96" width="20" height="16" rx="1.5" />
            <rect x="74" y="96" width="20" height="16" rx="1.5" />
            <rect x="100" y="96" width="20" height="16" rx="1.5" />
            <rect x="48" y="122" width="20" height="16" rx="1.5" />
            <rect x="100" y="122" width="20" height="16" rx="1.5" />
            <path d="M76 150 V124 H92 V150" />
          </g>
        </>
      )}
    </svg>
  );
}
