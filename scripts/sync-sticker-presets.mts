#!/usr/bin/env tsx
/**
 * Sync built-in sticker presets from code → public Template rows (for QR FK).
 *
 *   npx tsx scripts/sync-sticker-presets.mts
 */
import { prisma } from "../src/lib/prisma";
import { ensureStickerPresets } from "../src/lib/ensure-sticker-presets";
import { BUILTIN_STICKER_TEMPLATES } from "../src/lib/builtin-sticker-templates";

async function main() {
  await ensureStickerPresets();
  console.log(`Synced ${BUILTIN_STICKER_TEMPLATES.length} built-in sticker preset(s) to DB.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
