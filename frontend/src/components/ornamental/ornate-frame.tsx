import { type ReactNode } from "react";

function CornerOrnament({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M6 6 H46 M6 6 V46" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M6 6 C 6 34, 34 6, 64 6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 6 C 34 6, 46 16, 46 34" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M6 16 C 6 34, 16 46, 34 46" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="6" cy="6" r="5" fill="currentColor" />
      <circle cx="38" cy="14" r="2.5" fill="currentColor" />
      <circle cx="14" cy="38" r="2.5" fill="currentColor" />
    </svg>
  );
}

interface OrnateFrameProps {
  children: ReactNode;
  className?: string;
  cornerClassName?: string;
}

// Moldura decorativa com flourishes nos quatro cantos, no estilo de fichas de D&D.
export function OrnateFrame({ children, className = "", cornerClassName = "" }: OrnateFrameProps) {
  return (
    <div className={`relative rounded-xl border-2 border-primary/50 ${className}`}>
      <CornerOrnament
        className={`pointer-events-none absolute -left-1 -top-1 h-9 w-9 text-primary ${cornerClassName}`}
      />
      <CornerOrnament
        className={`pointer-events-none absolute -right-1 -top-1 h-9 w-9 -scale-x-100 text-primary ${cornerClassName}`}
      />
      <CornerOrnament
        className={`pointer-events-none absolute -bottom-1 -left-1 h-9 w-9 -scale-y-100 text-primary ${cornerClassName}`}
      />
      <CornerOrnament
        className={`pointer-events-none absolute -bottom-1 -right-1 h-9 w-9 -scale-x-100 -scale-y-100 text-primary ${cornerClassName}`}
      />
      {children}
    </div>
  );
}
