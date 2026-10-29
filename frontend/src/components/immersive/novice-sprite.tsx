"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

export function NoviceSprite({
  gender,
  hairStyle,
  fallback,
}: {
  gender: string;
  hairStyle: number;
  fallback: ReactNode;
}) {
  const style = Math.max(1, Math.min(20, hairStyle || 1));
  const sex = gender === "F" ? "female" : "male";
  const src = `/ragassets/characters/novice-${sex}-${style}.png`;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- url mudou
    setFailed(false);
  }, [src]);

  if (failed) return fallback;

  return (
    <Image
      src={src}
      alt=""
      width={208}
      height={210}
      unoptimized
      className="h-72 w-auto scale-[1.8] object-contain [image-rendering:pixelated]"
      onError={() => setFailed(true)}
    />
  );
}
