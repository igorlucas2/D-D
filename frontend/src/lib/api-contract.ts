import type { components } from "./openapi";

/**
 * Contrato gerado de `docs/openapi.json` (backend/Nest).
 * Use estes tipos em novas chamadas; os tipos manuais antigos continuam
 * válidos até a migração das telas.
 */
export type ApiComponents = components;
export type LoginRequest = components["schemas"]["LoginDto"];
export type RegisterRequest = components["schemas"]["RegisterDto"];
