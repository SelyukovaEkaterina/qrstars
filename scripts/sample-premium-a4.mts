#!/usr/bin/env tsx
/**
 * Sample renderer — использует ТОТ ЖЕ src/lib/premium-a4-sheet.ts, что и
 * админка (src/app/admin/batches/[id]/print/page.tsx). Здесь подменяются
 * только провайдеры: Cyrillic-текст через Arial.ttf и QR через `qrcode`.
 *
 * Run: npx tsx scripts/sample-premium-a4.mts
 * Output: /tmp/qrstars-premium-sample.pdf
 */
import fs from "node:fs";
import { jsPDF } from "jspdf";
import {
  renderPremiumA4Sheet,
  type PremiumA4Deps,
  type PremiumA4TextOpts,
  type PremiumA4Batch,
} from "../src/lib/premium-a4-sheet";

const FONT_REG = fs.readFileSync("/System/Library/Fonts/Supplemental/Arial.ttf");
const FONT_BOLD = fs.readFileSync("/System/Library/Fonts/Supplemental/Arial Bold.ttf");

// Mock batch — фабричная партия до активации. Названия заведения здесь нет,
// потому что на лицо стикера оно и не наносится.
const batch: PremiumA4Batch = {
  masterCode: "MC-7K2X9A4P",
  label: null,
  qrcodes: Array.from({ length: 6 }, (_, i) => ({
    code: `q${(i + 1).toString().padStart(2, "0")}x${Math.random().toString(36).slice(2, 10)}`,
    serialCode: `SR-${(i + 1).toString().padStart(4, "0")}`,
    isActive: false,
  })),
};

const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
doc.addFileToVFS("Arial.ttf", FONT_REG.toString("base64"));
doc.addFileToVFS("ArialB.ttf", FONT_BOLD.toString("base64"));
doc.addFont("Arial.ttf", "Arial", "normal");
doc.addFont("ArialB.ttf", "Arial", "bold");

const text = (s: string, x: number, y: number, opts: PremiumA4TextOpts = {}) => {
  const { size = 8, bold = false, rgb = [40, 40, 40], align = "left", angle, charSpacing } = opts;
  doc.setFont("Arial", bold ? "bold" : "normal");
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

const deps: PremiumA4Deps = {
  doc, text,
  baseUrl: "https://qrstars.ru",
};

await renderPremiumA4Sheet(batch, deps);

const out = "/tmp/qrstars-premium-sample.pdf";
const buf = Buffer.from(doc.output("arraybuffer"));
fs.writeFileSync(out, buf);
console.log(`✓ saved: ${out}  (${(buf.length / 1024).toFixed(1)} KB)`);
