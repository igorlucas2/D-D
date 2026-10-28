"use client";

import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CampaignPartyWidget } from "@/components/campaigns/campaign-party-widget";
import { useAuthStore } from "@/stores/auth-store";

/**
 * A companhia acompanha as telas de consulta e preparação. Na Mesa raiz os
 * cards já ficam no dock da crônica; em /play existe o HUD completo.
 */
export default function CampaignLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const isRoot = pathname === `/campaigns/${id}`;
  const isPlay = pathname === `/campaigns/${id}/play`;

  return (
    <>
      {children}
      {token && id && !isRoot && !isPlay ? (
        <CampaignPartyWidget campaignId={id} />
      ) : null}
    </>
  );
}
