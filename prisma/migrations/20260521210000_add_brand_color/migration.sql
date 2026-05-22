-- Цвет бренда и светлая/тёмная страница вместо landingTheme
ALTER TABLE "Establishment" ADD COLUMN IF NOT EXISTS "brandColor" TEXT NOT NULL DEFAULT '#4f46e5';
ALTER TABLE "Establishment" ADD COLUMN IF NOT EXISTS "pageAppearance" TEXT NOT NULL DEFAULT 'light';

UPDATE "Establishment" SET "brandColor" = '#4f46e5', "pageAppearance" = 'light'
WHERE "landingTheme" IS NULL OR "landingTheme" = 'default';

UPDATE "Establishment" SET "brandColor" = '#0369a1', "pageAppearance" = 'light'
WHERE "landingTheme" = 'ocean';

UPDATE "Establishment" SET "brandColor" = '#ea580c', "pageAppearance" = 'light'
WHERE "landingTheme" = 'sunset';

UPDATE "Establishment" SET "brandColor" = '#059669', "pageAppearance" = 'light'
WHERE "landingTheme" = 'emerald';

UPDATE "Establishment" SET "brandColor" = '#e11d48', "pageAppearance" = 'light'
WHERE "landingTheme" = 'rose';

UPDATE "Establishment" SET "brandColor" = '#818cf8', "pageAppearance" = 'dark'
WHERE "landingTheme" = 'dark';
