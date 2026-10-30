"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { ragnarokSpriteUrl } from "./ragnarok-sprite-url";

export function RagnarokSprite({
  jobId,
  gender,
  hairStyle,
  fallback,
}: {
  jobId: number;
  gender: string;
  hairStyle: number;
  fallback: ReactNode;
}) {
  const src = ragnarokSpriteUrl(jobId, gender, hairStyle);
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
