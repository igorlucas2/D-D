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
}

export interface SrdSyncResult {
  source: string;
  endpoints: SrdSyncEndpointResult[];
  imported: number;
}
