-- PlatformMeta for one-time deploy markers
CREATE TABLE "PlatformMeta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMeta_pkey" PRIMARY KEY ("key")
);

-- Cutoff: users registered before this moment are "legacy" cohort
INSERT INTO "PlatformMeta" ("key", "value", "updatedAt")
VALUES ('lifecycle_legacy_cutoff', NOW()::text, NOW());

-- Mark all pre-launch lifecycle emails as sent (except feedback — sent via feedback-launch cron)
INSERT INTO "UserLifecycleEmail" ("id", "userId", "campaignKey", "sentAt")
SELECT
    gen_random_uuid()::text,
    u.id,
    c.key,
    NOW()
FROM "User" u
CROSS JOIN (
    VALUES
        ('welcome'),
        ('no_establishment_d1'),
        ('no_establishment_d3'),
        ('no_qr_d1'),
        ('no_qr_d4'),
        ('no_scans_d2'),
        ('no_scans_d5'),
        ('no_reviews_d3'),
        ('connect_telegram_d2'),
        ('pro_hint_d14')
) AS c(key)
WHERE u.role <> 'ADMIN'
ON CONFLICT ("userId", "campaignKey") DO NOTHING;
