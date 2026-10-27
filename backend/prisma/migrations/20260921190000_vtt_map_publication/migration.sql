-- Existing scenes remain available to the master and require explicit publication.
ALTER TABLE "VttMap" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
