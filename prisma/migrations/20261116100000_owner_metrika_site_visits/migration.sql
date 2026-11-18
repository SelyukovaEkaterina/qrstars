-- Своя Яндекс Метрика владельца и заходы на короткий адрес проекта
ALTER TABLE "Establishment" ADD COLUMN "metrikaCounterId" TEXT;

CREATE TABLE "SiteVisitStat" (
    "id" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SiteVisitStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteVisitStat_establishmentId_date_key" ON "SiteVisitStat"("establishmentId", "date");
CREATE INDEX "SiteVisitStat_date_idx" ON "SiteVisitStat"("date");

ALTER TABLE "SiteVisitStat" ADD CONSTRAINT "SiteVisitStat_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
