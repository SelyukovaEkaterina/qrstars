import type { QRContentState } from "./types";

function escapeWifiField(val: string): string {
  return val.replace(/([\\;,:"'])/g, "\\$1");
}

export function buildQRPayload(content: QRContentState): string | null {
  switch (content.type) {
    case "url":
      return content.url.trim() || null;
    case "wifi": {
      const ssid = content.wifiSsid.trim();
      if (!ssid) return null;
      return `WIFI:T:${content.wifiEnc};S:${escapeWifiField(ssid)};P:${escapeWifiField(
        content.wifiPass,
      )};;`;
    }
    case "text":
      return content.text.trim() || null;
    case "email": {
      const addr = content.emailAddr.trim();
      if (!addr) return null;
      let mailto = `mailto:${addr}`;
      const params: string[] = [];
      if (content.emailSubj.trim())
        params.push(`subject=${encodeURIComponent(content.emailSubj.trim())}`);
      if (content.emailBody.trim())
        params.push(`body=${encodeURIComponent(content.emailBody.trim())}`);
      if (params.length) mailto += "?" + params.join("&");
      return mailto;
    }
    case "phone": {
      const v = content.phone.trim();
      if (!v) return null;
      const digits = v
        .replace(/[^\d+\-() ]/g, "")
        .replace(/[\-() ]/g, "");
      return `tel:${digits}`;
    }
    case "vcard": {
      const fname = content.vcardFname.trim();
      const lname = content.vcardLname.trim();
      if (!fname && !lname) return null;
      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      lines.push(`N:${lname};${fname};;;`);
      lines.push(`FN:${[fname, lname].filter(Boolean).join(" ")}`);
      if (content.vcardOrg.trim()) lines.push(`ORG:${content.vcardOrg.trim()}`);
      if (content.vcardPhone.trim())
        lines.push(`TEL;TYPE=CELL:${content.vcardPhone.trim()}`);
      if (content.vcardEmail.trim()) lines.push(`EMAIL:${content.vcardEmail.trim()}`);
      if (content.vcardUrl.trim()) lines.push(`URL:${content.vcardUrl.trim()}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
    case "sms": {
      const phone = content.smsPhone.trim();
      if (!phone) return null;
      const body = content.smsBody.trim();
      const digits = phone.replace(/[^\d+]/g, "");
      return body ? `SMSTO:${digits}:${body}` : `sms:${digits}`;
    }
    default:
      return null;
  }
}

export const DEFAULT_QR_CONTENT: QRContentState = {
  type: "url",
  url: "https://qrstars.ru",
  wifiSsid: "",
  wifiPass: "",
  wifiEnc: "WPA",
  text: "",
  emailAddr: "",
  emailSubj: "",
  emailBody: "",
  phone: "",
  vcardFname: "",
  vcardLname: "",
  vcardPhone: "",
  vcardEmail: "",
  vcardOrg: "",
  vcardUrl: "",
  smsPhone: "",
  smsBody: "",
};

export function parseCenterTextLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);
}
