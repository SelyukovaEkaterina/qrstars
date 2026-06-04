import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
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

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  } catch {
    // bucket already exists
  }
}

export async function uploadObject(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await ensureBucket();

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
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
