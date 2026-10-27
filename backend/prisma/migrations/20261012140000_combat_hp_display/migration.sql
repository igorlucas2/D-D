-- Modo de exibicao do PV de inimigos (decisao 4 da spec de imersao).
ALTER TABLE "Campaign" ADD COLUMN "combatHpDisplay" TEXT NOT NULL DEFAULT 'DESCRIPTIVE';
ALTER TABLE "CombatEncounter" ADD COLUMN "hpDisplay" TEXT NOT NULL DEFAULT 'DESCRIPTIVE';
