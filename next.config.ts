import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn1.interspar.at",
      },
      {
        protocol: "https",
        hostname: "imgproxy-retcat.assets.schwarz",
      },
    ],
  },
};

export default nextConfig;
