import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function encryptionKey(): Buffer {
  const raw =
    process.env.IIKO_ENCRYPTION_KEY?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "";
  if (!raw) {
    throw new Error("IIKO_ENCRYPTION_KEY or NEXTAUTH_SECRET required for iiko API login storage");
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptApiLogin(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptApiLogin(stored: string): string {
  if (!stored.startsWith("v1:")) {
    return stored;
  }
  const [, ivB64, tagB64, dataB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function maskApiLogin(_login: string): string {
  return "••••••••";
}
