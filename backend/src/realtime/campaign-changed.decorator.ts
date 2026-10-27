import { SetMetadata } from '@nestjs/common';

export const CAMPAIGN_CHANGED = 'eldoria:campaign-changed';

/**
 * Invalida os snapshots das telas da campanha depois de uma mutação. O evento
 * não carrega dados: cada cliente autorizado busca o snapshot via HTTP.
 */
export const CampaignChanged = () => SetMetadata(CAMPAIGN_CHANGED, true);
