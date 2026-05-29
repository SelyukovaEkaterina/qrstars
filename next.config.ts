import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.31.23", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s3.qrstars.ru",
      },
    ],
  },
};

export default nextConfig;
