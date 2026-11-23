BEGIN;

-- CreateEnum
CREATE TYPE "StoreCode" AS ENUM ('steam', 'epic');

-- CreateEnum
CREATE TYPE "PriceState" AS ENUM ('available', 'price_missing', 'unavailable');

-- CreateTable
CREATE TABLE "games" (
    "id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "edition" VARCHAR(100) NOT NULL,
    "platform" VARCHAR(30) NOT NULL,
    "imageUrl" TEXT,
    "catalogOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "code" "StoreCode" NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "store_offers" (
    "id" UUID NOT NULL,
    "gameId" VARCHAR(100) NOT NULL,
    "storeCode" "StoreCode" NOT NULL,
    "steamAppId" BIGINT,
    "epicNamespace" VARCHAR(100),
    "epicOfferId" VARCHAR(100),
    "epicPageSlug" VARCHAR(100),

    CONSTRAINT "store_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_observations" (
    "id" BIGSERIAL NOT NULL,
    "offerId" UUID NOT NULL,
    "priceCents" BIGINT,
    "currency" CHAR(3) NOT NULL,
    "region" CHAR(2) NOT NULL,
    "state" "PriceState" NOT NULL,
    "collectedAt" TIMESTAMPTZ(3) NOT NULL,
    "sourceRecordedAt" TIMESTAMPTZ(3),

    CONSTRAINT "price_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_offers_steamAppId_key" ON "store_offers"("steamAppId");

-- CreateIndex
CREATE INDEX "store_offers_storeCode_idx" ON "store_offers"("storeCode");

-- CreateIndex
CREATE UNIQUE INDEX "store_offers_gameId_storeCode_key" ON "store_offers"("gameId", "storeCode");

-- CreateIndex
CREATE UNIQUE INDEX "store_offers_epicNamespace_epicOfferId_key" ON "store_offers"("epicNamespace", "epicOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "price_observations_offerId_region_collectedAt_key" ON "price_observations"("offerId", "region", "collectedAt");

-- AddForeignKey
ALTER TABLE "store_offers" ADD CONSTRAINT "store_offers_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_offers" ADD CONSTRAINT "store_offers_storeCode_fkey" FOREIGN KEY ("storeCode") REFERENCES "stores"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "store_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "store_offers" ADD CONSTRAINT "store_offers_identity_check" CHECK (
    ("storeCode" = 'steam' AND "steamAppId" IS NOT NULL AND "steamAppId" BETWEEN 1 AND 9007199254740991
      AND "epicNamespace" IS NULL AND "epicOfferId" IS NULL AND "epicPageSlug" IS NULL)
    OR
    ("storeCode" = 'epic' AND "steamAppId" IS NULL
      AND "epicNamespace" IS NOT NULL AND "epicNamespace" ~* '^[a-z0-9_-]+$'
      AND "epicOfferId" IS NOT NULL AND "epicOfferId" ~* '^[a-z0-9-]+$'
      AND "epicPageSlug" IS NOT NULL AND "epicPageSlug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_price_check" CHECK (
    ("state" = 'available' AND "priceCents" IS NOT NULL AND "priceCents" >= 0)
    OR ("state" <> 'available' AND "priceCents" IS NULL)
);

ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_market_check" CHECK (
    "currency" ~ '^[A-Z]{3}$' AND "region" ~ '^[A-Z]{2}$'
);

COMMIT;
