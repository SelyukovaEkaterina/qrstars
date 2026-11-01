/**
 * Минимальный PDF: каждая страница — одна JPEG-картинка во всю страницу,
 * поверх неё — необязательные векторные линии (метки реза).
 * TrimBox/BleedBox нужны типографии, чтобы понять, где обрезной формат.
 */

const PT_PER_MM = 72 / 25.4;

export interface PdfPage {
  jpeg: Uint8Array;
  pxW: number;
  pxH: number;
  /** Размер страницы, мм. */
  wMm: number;
  hMm: number;
  /** Вылеты, мм: TrimBox = MediaBox минус bleed с каждой стороны. */
  bleedMm?: number;
  /** Линии в мм от левого верхнего угла: [x1, y1, x2, y2]. */
  lines?: [number, number, number, number][];
}

export async function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.95): Promise<Uint8Array> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

export function buildPdf(pages: PdfPage[], title = 'Визитка'): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(bytes);
    pos += bytes.length;
  };
  const obj = (id: number, body: string | (() => void)) => {
    offsets[id] = pos;
    push(`${id} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body();
    push('\nendobj\n');
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // 1 — каталог, 2 — дерево страниц, 3 — метаданные; затем по 3 объекта на страницу.
  const pageIds = pages.map((_, i) => 4 + i * 3);
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`);
  const hexTitle = Array.from(title)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('');
  obj(3, `<< /Title <FEFF${hexTitle}> /Producer (QrStars card maker) >>`);

  pages.forEach((p, i) => {
    const pageId = pageIds[i];
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const w = p.wMm * PT_PER_MM;
    const h = p.hMm * PT_PER_MM;
    const b = (p.bleedMm ?? 0) * PT_PER_MM;
    const boxes = b > 0 ? ` /BleedBox [0 0 ${f(w)} ${f(h)}] /TrimBox [${f(b)} ${f(b)} ${f(w - b)} ${f(h - b)}]` : '';
    obj(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(w)} ${f(h)}]${boxes} /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    let content = `q ${f(w)} 0 0 ${f(h)} 0 0 cm /Im${i} Do Q\n`;
    if (p.lines?.length) {
      content += '0 0 0 RG 0.3 w\n';
      for (const [x1, y1, x2, y2] of p.lines) {
        content += `${f(x1 * PT_PER_MM)} ${f(h - y1 * PT_PER_MM)} m ${f(x2 * PT_PER_MM)} ${f(h - y2 * PT_PER_MM)} l S\n`;
      }
    }
    obj(contentId, `<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`);
    obj(imageId, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${p.pxW} /Height ${p.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      );
      push(p.jpeg);
      push('\nendstream');
    });
  });

  const xrefPos = pos;
  const count = 4 + pages.length * 3;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let id = 1; id < count; id++) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}
