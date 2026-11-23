BEGIN;

CREATE TABLE "price_alerts" (
    "id" BIGSERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "observationId" BIGINT NOT NULL,
    "gameId" VARCHAR(100) NOT NULL,
    "gameName" VARCHAR(200) NOT NULL,
    "store" "StoreCode" NOT NULL,
    "storeUrl" TEXT NOT NULL,
    "region" CHAR(2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "previousPriceCents" BIGINT NOT NULL,
    "newPriceCents" BIGINT NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "price_alerts_price_check" CHECK ("newPriceCents" >= 0 AND "newPriceCents" < "previousPriceCents"),
    CONSTRAINT "price_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "price_alerts_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "price_observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "price_alerts_userId_offerId_observationId_key" ON "price_alerts"("userId", "offerId", "observationId");
CREATE INDEX "price_alerts_userId_id_idx" ON "price_alerts"("userId", "id");
CREATE INDEX "price_alerts_userId_readAt_idx" ON "price_alerts"("userId", "readAt");
CREATE INDEX "price_alerts_observationId_idx" ON "price_alerts"("observationId");
CREATE INDEX "price_observations_alert_baseline_idx" ON "price_observations"("offerId", "region", "currency", "state", "collectedAt");

COMMIT;
