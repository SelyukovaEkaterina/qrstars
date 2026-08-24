import type { NextConfig } from "next";

const s3PublicBase = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
const s3Endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, "");
const s3Bucket = process.env.S3_BUCKET || "qrwin-logos";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.31.23", "localhost"],
  // Match FILE_MAX_SIZE (25 MB) + multipart overhead; nginx allows 32m.
  experimental: {
    proxyClientMaxBodySize: "32mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s3.qrstars.ru",
      },
    ],
  },
  async rewrites() {
    if (s3PublicBase) {
      return [{ source: "/storage/:path*", destination: `${s3PublicBase}/:path*` }];
    }
    if (s3Endpoint) {
      return [{ source: "/storage/:path*", destination: `${s3Endpoint}/${s3Bucket}/:path*` }];
    }
    return [];
  },
};

export default nextConfig;
