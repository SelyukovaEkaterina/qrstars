/** Раскладка стикеров на листе A4 для PDF-печати. */

export interface A4StickerGrid {
  cols: number;
  rows: number;
  perPage: number;
  marginX: number;
  marginY: number;
  spacing: number;
  orientation: "portrait" | "landscape";
}

export function calcA4StickerGrid(
  formatId: string,
  wMm: number,
  hMm: number,
): A4StickerGrid {
  let cols = 1;
  let rows = 1;
  let spacing = 5;
  let marginX = 10;
  let marginY = 10;
  let orientation: "portrait" | "landscape" = "portrait";
  let pageW = 210;
  let pageH = 297;

  if (formatId === "a6p") {
    // A6 портрет: 4 листа на A4 книжной ориентации (2 × 2)
    cols = 2;
    rows = 2;
    spacing = 0;
    marginX = 0;
    marginY = 0.5;
  } else if (formatId === "a6l") {
    // A6 альбом (тейбл-тент): поворачиваем A4 — 4 шт. (2 × 2)
    orientation = "landscape";
    pageW = 297;
    pageH = 210;
    cols = 2;
    rows = 2;
    spacing = 0;
    marginX = 0.5;
    marginY = 0;
  } else {
    cols = Math.floor((pageW - 10 + spacing) / (wMm + spacing));
    rows = Math.floor((pageH - 10 + spacing) / (hMm + spacing));
    if (cols < 1) cols = 1;
    if (rows < 1) rows = 1;

    const totalGridW = cols * wMm + (cols - 1) * spacing;
    const totalGridH = rows * hMm + (rows - 1) * spacing;
    marginX = (pageW - totalGridW) / 2;
    marginY = (pageH - totalGridH) / 2;
  }

  return { cols, rows, perPage: cols * rows, marginX, marginY, spacing, orientation };
}
