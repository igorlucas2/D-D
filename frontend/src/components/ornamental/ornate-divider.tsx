interface OrnateDividerProps {
  className?: string;
}

// Divisor decorativo com um rune/losango central, usado para separar seções da ficha.
export function OrnateDivider({ className = "" }: OrnateDividerProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`} role="separator" aria-hidden="true">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/50 to-primary/70" />
      <svg width="18" height="18" viewBox="0 0 20 20" className="shrink-0 text-primary">
        <path
          d="M10 0 L13 7 L20 10 L13 13 L10 20 L7 13 L0 10 L7 7 Z"
          fill="currentColor"
          opacity="0.85"
        />
        <circle cx="10" cy="10" r="2" fill="var(--background)" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-primary/50 to-primary/70" />
    </div>
  );
}

// Brasão decorativo simples, usado como selo perto do nome do personagem.
export function Crest({ className = "" }: OrnateDividerProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M32 2 L58 12 V30 C58 46 47 57 32 62 C17 57 6 46 6 30 V12 Z"
        fill="currentColor"
        opacity="0.12"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M32 9 L51 17 V30 C51 43 43 51 32 55 C21 51 13 43 13 30 V17 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.7"
      />
      <path
        d="M32 20 L36 28 L45 29 L38 35 L40 44 L32 39 L24 44 L26 35 L19 29 L28 28 Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}
