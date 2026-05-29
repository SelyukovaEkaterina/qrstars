#!/usr/bin/env tsx
/**
 * Массовая генерация фабричных партий QR-стикеров + PDF-макетов для печати.
 *
 * Создаёт N независимых батчей по M кодов каждый в БД, для каждого батча
 * рендерит «Премиум A4 · 8×8 см» PDF единым модулем src/lib/premium-a4-sheet.ts
 * (тем же, что и в админке).
 *
 * Запуск (внутри контейнера):
 *   npx tsx scripts/generate-batches.mts --count 10 --qty 6 --out /tmp/batches
 *
 * После — выгрузить с сервера:
 *   docker cp deploy-app-1:/tmp/batches ./batches
 */
import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import { prisma } from "../src/lib/prisma";
import {
  generateQRCode,
  generateSerialCode,
  generateMasterCode,
} from "../src/lib/utils";
import {
  renderPremiumA4Sheet,
  type PremiumA4Deps,
  type PremiumA4TextOpts,
  type PremiumA4Batch,
} from "../src/lib/premium-a4-sheet";

/* ── CLI args ──────────────────────────────────────────────────────────── */
function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}
const COUNT = parseInt(arg("count", "10")!, 10);
const QTY   = parseInt(arg("qty",   "6")!, 10);
const OUT   = arg("out", "/tmp/batches")!;
const PREFIX = arg("label-prefix", "");
const BASE_URL =
  arg("base-url") || process.env.PUBLIC_BASE_URL || "https://qrstars.ru";

if (!Number.isFinite(COUNT) || COUNT < 1 || COUNT > 1000) {
  console.error("Bad --count (1..1000)"); process.exit(1);
}
if (!Number.isFinite(QTY) || QTY < 1 || QTY > 100) {
  console.error("Bad --qty (1..100)"); process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

/* ── Font discovery — DejaVu Sans bundled by `apk add ttf-dejavu` ─────── */
function findFont(name: string): Buffer {
  const candidates = [
    `/usr/share/fonts/dejavu/${name}`,
    `/usr/share/fonts/truetype/dejavu/${name}`,
    `/Library/Fonts/${name}`,
    `/System/Library/Fonts/Supplemental/${name}`,
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  throw new Error(
    `Font not found: ${name}. Tried:\n  ${candidates.join("\n  ")}\n` +
    `On Alpine: apk add ttf-dejavu`
  );
}
const FONT_REG  = findFont("DejaVuSans.ttf");
const FONT_BOLD = findFont("DejaVuSans-Bold.ttf");

/* ── Helpers ───────────────────────────────────────────────────────────── */
async function uniqueMasterCode(): Promise<string> {
  for (let i = 0; i < 16; i++) {
    const mc = generateMasterCode();
    const found = await prisma.activationBatch.findUnique({ where: { masterCode: mc } });
    if (!found) return mc;
  }
  throw new Error("Could not generate unique masterCode");
}

async function uniqueQRCode(): Promise<string> {
  for (let i = 0; i < 16; i++) {
    const c = generateQRCode();
    const found = await prisma.qRCode.findUnique({ where: { code: c } });
    if (!found) return c;
  }
  throw new Error("Could not generate unique QR code");
}

async function uniqueSerialCode(batchId: string): Promise<string> {
  for (let i = 0; i < 16; i++) {
    const s = generateSerialCode();
    const found = await prisma.qRCode.findFirst({ where: { batchId, serialCode: s } });
    if (!found) return s;
  }
  throw new Error("Could not generate unique serialCode");
}

/* ── Build one batch in DB ─────────────────────────────────────────────── */
async function createBatch(label: string): Promise<PremiumA4Batch> {
  const masterCode = await uniqueMasterCode();
  const batch = await prisma.activationBatch.create({
    data: { masterCode, qty: QTY, label, status: "PENDING" },
  });
  const qrcodes: PremiumA4Batch["qrcodes"] = [];
  for (let i = 0; i < QTY; i++) {
    const code = await uniqueQRCode();
    const serialCode = await uniqueSerialCode(batch.id);
    const qr = await prisma.qRCode.create({
      data: {
        code, serialCode,
        source: "MARKETPLACE",
        isActive: false,
        batch: { connect: { id: batch.id } },
      },
    });
    qrcodes.push({ code: qr.code, serialCode: qr.serialCode, isActive: false });
  }
  return { masterCode, label, qrcodes };
}

/* ── PDF for one batch ─────────────────────────────────────────────────── */
async function renderBatchPdf(batch: PremiumA4Batch): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.addFileToVFS("DejaVuSans.ttf",     FONT_REG.toString("base64"));
  doc.addFileToVFS("DejaVuSans-Bold.ttf", FONT_BOLD.toString("base64"));
  doc.addFont("DejaVuSans.ttf",     "DejaVu", "normal");
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");

  const text = (s: string, x: number, y: number, opts: PremiumA4TextOpts = {}) => {
    const { size = 8, bold = false, rgb = [40, 40, 40], align = "left", angle, charSpacing } = opts;
    doc.setFont("DejaVu", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (charSpacing) (doc as any).setCharSpace?.(charSpacing);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textOpts: any = { align };
    if (angle !== undefined) textOpts.angle = angle;
    doc.text(s, x, y, textOpts);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (charSpacing) (doc as any).setCharSpace?.(0);
  };

  const deps: PremiumA4Deps = { doc, text, baseUrl: BASE_URL };
  await renderPremiumA4Sheet(batch, deps);
  return Buffer.from(doc.output("arraybuffer"));
}

/* ── Main loop ─────────────────────────────────────────────────────────── */
console.log(`Generating ${COUNT} batches × ${QTY} codes → ${OUT}`);
console.log(`Base URL: ${BASE_URL}`);

const summary: Array<{ masterCode: string; pdf: string; label: string }> = [];
const startedAt = Date.now();

for (let i = 0; i < COUNT; i++) {
  const num = (i + 1).toString().padStart(3, "0");
  const label = PREFIX ? `${PREFIX}-${num}` : `pack-${num}`;
  const batch = await createBatch(label);

  const pdf = await renderBatchPdf(batch);
  const pdfPath = path.join(OUT, `${label}-${batch.masterCode}.pdf`);
  fs.writeFileSync(pdfPath, pdf);

  summary.push({ masterCode: batch.masterCode, pdf: pdfPath, label });
  process.stdout.write(`  [${i + 1}/${COUNT}] ${label} · ${batch.masterCode} · ${(pdf.length / 1024).toFixed(0)} KB\n`);
}

// Index file with all master codes — для удобства
const indexPath = path.join(OUT, "INDEX.txt");
const indexLines = [
  `# Generated: ${new Date().toISOString()}`,
  `# Total batches: ${COUNT}, codes per batch: ${QTY}`,
  `# Base URL: ${BASE_URL}`,
  ``,
  ...summary.map((s) =>
    `${s.label}\t${s.masterCode}\thttps://${BASE_URL.replace(/^https?:\/\//, "")}/activate/batch/${s.masterCode}\t${path.basename(s.pdf)}`,
  ),
];
fs.writeFileSync(indexPath, indexLines.join("\n") + "\n");

const dur = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\n✓ Done in ${dur}s`);
console.log(`  PDFs:  ${OUT}`);
console.log(`  Index: ${indexPath}`);

await prisma.$disconnect();
