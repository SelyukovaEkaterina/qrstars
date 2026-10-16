const SAVE_SHEET_ID = "qr-file-save-sheet";

/** iPhone, iPad and iPadOS (desktop UA + touch). All of them use WebKit. */
export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Не удалось подготовить файл"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

/**
 * Save a generated file.
 * Desktop and Android get a normal download. iOS Safari ignores `download` on
 * a large data-URL and drops the click that happens after canvas rendering,
 * so there we open the system share sheet (Save Image / Files). If the click
 * gesture has already expired, a sheet with the picture stays on screen:
 * a second tap is a fresh gesture, and a long-press on the image still saves it.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const type = blob.type || "application/octet-stream";
  const file = new File([blob], filename, { type });
  if (isIosDevice()) {
    const shared = await shareIosFile(file);
    if (shared === "shared" || shared === "cancelled") return;
    showIosSaveSheet(file);
    return;
  }
  clickDownloadLink(blob, filename);
}

export async function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  type = "image/png",
  quality?: number,
): Promise<void> {
  const blob = await canvasToBlob(canvas, type, quality);
  await downloadBlob(blob, filename);
}

type ShareResult = "shared" | "cancelled" | "unavailable";

function canShareFile(file: File): boolean {
  try {
    return !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

async function shareIosFile(file: File): Promise<ShareResult> {
  if (!navigator.share || !canShareFile(file)) return "unavailable";
  try {
    await navigator.share({ files: [file] });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return "unavailable";
  }
}

function clickDownloadLink(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function showIosSaveSheet(file: File): void {
  document.getElementById(SAVE_SHEET_ID)?.remove();
  const url = URL.createObjectURL(file);

  const overlay = document.createElement("div");
  overlay.id = SAVE_SHEET_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "10000",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-end",
    background: "rgba(15, 23, 42, 0.45)",
    padding: "16px",
    boxSizing: "border-box",
  });

  const panel = document.createElement("div");
  const viewport =
    document.documentElement?.clientWidth ||
    (typeof window !== "undefined" ? window.innerWidth : 0) ||
    360;
  Object.assign(panel.style, {
    width: `${Math.min(420, Math.max(280, viewport - 32))}px`,
    maxWidth: "100%",
    boxSizing: "border-box",
    margin: "0 auto",
    background: "#fff",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "0 12px 40px rgba(15, 23, 42, 0.2)",
  });

  const title = document.createElement("p");
  title.textContent = "Сохранить файл";
  Object.assign(title.style, {
    margin: "0 0 12px",
    fontSize: "16px",
    fontWeight: "600",
    color: "#0f172a",
  });

  const img = document.createElement("img");
  img.src = url;
  img.alt = file.name;
  Object.assign(img.style, {
    display: "block",
    width: "100%",
    maxHeight: "46vh",
    objectFit: "contain",
    background: "#f8fafc",
    borderRadius: "12px",
  });

  const hint = document.createElement("p");
  hint.textContent = "Нажмите «Сохранить» или зажмите картинку и выберите «Сохранить изображение».";
  Object.assign(hint.style, {
    margin: "12px 0",
    fontSize: "13px",
    lineHeight: "1.4",
    color: "#475569",
    overflowWrap: "break-word",
  });

  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "Сохранить";
  Object.assign(save.style, {
    width: "100%",
    border: "0",
    borderRadius: "10px",
    padding: "12px 16px",
    background: "#4f46e5",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "600",
  });

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Закрыть";
  Object.assign(close.style, {
    width: "100%",
    marginTop: "8px",
    border: "0",
    borderRadius: "10px",
    padding: "10px 16px",
    background: "transparent",
    color: "#64748b",
    fontSize: "14px",
  });

  const dismiss = () => {
    overlay.remove();
    URL.revokeObjectURL(url);
  };

  save.addEventListener("click", () => {
    void shareIosFile(file).then((result) => {
      if (result === "shared") dismiss();
      else if (result === "unavailable") {
        hint.textContent = "Меню сохранения не открылось. Зажмите картинку и выберите «Сохранить изображение».";
      }
    });
  });
  close.addEventListener("click", dismiss);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) dismiss();
  });

  panel.append(title, img, hint, save, close);
  overlay.append(panel);
  document.body.append(overlay);
}
