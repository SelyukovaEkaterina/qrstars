declare module "qrcode/lib/core/qrcode" {
  interface QRModules {
    size: number;
    data: Uint8Array;
  }
  interface QRData {
    modules: QRModules;
  }
  interface Options {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }
  export function create(data: string, options?: Options): QRData;
}
