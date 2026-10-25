-- Forward index for mentor ALL / newest-first pages (status-unscoped ORDER BY created_at, id).
-- Measured on an 800-row synthetic corpus: prior plan used Seq Scan + top-N sort.
CREATE INDEX "submissions_created_idx" ON "submissions"("created_at" DESC, "id" DESC);
