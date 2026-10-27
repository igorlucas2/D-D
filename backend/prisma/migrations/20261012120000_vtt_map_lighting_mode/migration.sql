-- Iluminacao por fase do dia (IM-01). AUTO mantem o comportamento por tipo de mapa.
ALTER TABLE "VttMap" ADD COLUMN "lightingMode" TEXT NOT NULL DEFAULT 'AUTO';
