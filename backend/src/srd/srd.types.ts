export interface SrdReference {
  index: string;
  name: string;
  url: string;
  updated_at?: string;
}

export interface SrdListResponse {
  count?: number;
  results?: SrdReference[];
}

export interface SrdSyncEndpointResult {
  endpoint: string;
  total: number;
  imported: number;
  /** true quando o orçamento de tempo acabou no meio deste endpoint. */
  partial?: boolean;
}

export interface SrdSyncResult {
  source: string;
  endpoints: SrdSyncEndpointResult[];
  imported: number;
  /** true quando a sincronização parou antes de percorrer tudo. */
  partial?: boolean;
  /** Quantos endpoints ficaram de fora nesta execução. */
  remaining?: number;
}
