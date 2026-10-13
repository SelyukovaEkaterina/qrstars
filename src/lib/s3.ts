import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || "qrwin-logos";

/** Public URL for uploaded files — always relative, resolved by browser/nginx to same origin. */
export function getPublicUrl(key: string): string {
  return `/storage/${key}`;
}

/**
 * Абсолютный URL файла для внешних получателей (Telegram, email).
 *
 * `getPublicUrl` отдаёт относительный путь: браузер достраивает хост сам, а
 * Telegram и почтовые клиенты так не умеют. Bot API отвечает
 * `Bad Request: invalid file HTTP URL specified: URL host is empty` и вложение
 * в чат не уходит. Поэтому на границе с внешним сервисом путь всегда полный.
 */
export function getAbsolutePublicUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "https://app.qrstars.ru"
  ).replace(/\/+$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  } catch {
    // bucket already exists
    return;
  }

  // Только что созданный бакет — локальный MinIO (в проде бакет уже есть).
  // Открываем анонимное чтение, чтобы /storage отдавал файлы как на проде.
  try {
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: BUCKET,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${BUCKET}/*`],
            },
          ],
        }),
      })
    );
  } catch (e) {
    console.error("S3 bucket policy error:", e);
  }
}

export async function uploadObject(
  key: string,
  buffer: Buffer,
  contentType: string,
  options?: { contentDisposition?: string }
): Promise<string> {
  await ensureBucket();

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ...(options?.contentDisposition && {
        ContentDisposition: options.contentDisposition,
      }),
    })
  );

  return getPublicUrl(key);
}

export async function uploadLogo(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  return uploadObject(key, buffer, contentType);
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

export { s3, BUCKET };
