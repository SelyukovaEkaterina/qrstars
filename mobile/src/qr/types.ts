export type QRDotStyle = "classic" | "rounded";
export type QREyeStyle = "square" | "rounded" | "circle" | "leaf" | "dot";
export type QRGradientType = "linear-tb" | "linear-lr" | "linear-diag" | "radial";
export type QRFrameStyle = "bottom" | "rounded" | "ribbon";
export type QRScatterShape =
  | "square"
  | "circle"
  | "star"
  | "diamond"
  | "hexagon"
  | "heart"
  | "cross"
  | "octagon"
  | "triangle";
export type QRCenterMode = "image" | "text";
export type QRCenterTextFont = "inter" | "sans" | "serif" | "mono" | "display";

export interface QRTemplateConfig {
  dotStyle: QRDotStyle;
  eyeStyle: QREyeStyle;
  fg: string;
  bg: string;
  bgTransparent: boolean;
  gradient: boolean;
  grad1: string;
  grad2: string;
  gradType: QRGradientType;
  eyeCustom: boolean;
  eyeColor: string;
  logoPreset: string | null;
  logoDataUrl: string | null;
  logoFill: boolean;
  logoSize: number;
  centerMode: QRCenterMode;
  centerText: string;
  centerTextFont: QRCenterTextFont;
  centerTextColor: string;
  centerTextBold: boolean;
  frame: boolean;
  frameText: string;
  frameStyle: QRFrameStyle;
  ecc: "L" | "M" | "Q" | "H";
  margin: number;
  scatter: boolean;
  scatterDensity: number;
  scatterShape: QRScatterShape;
}

export type QRContentType = "url" | "wifi" | "text" | "email" | "phone" | "vcard" | "sms";

export interface QRContentState {
  type: QRContentType;
  url: string;
  wifiSsid: string;
  wifiPass: string;
  wifiEnc: "WPA" | "WEP" | "nopass";
  text: string;
  emailAddr: string;
  emailSubj: string;
  emailBody: string;
  phone: string;
  vcardFname: string;
  vcardLname: string;
  vcardPhone: string;
  vcardEmail: string;
  vcardOrg: string;
  vcardUrl: string;
  smsPhone: string;
  smsBody: string;
}

export interface LogoPreset {
  name: string;
  emoji?: string;
}
