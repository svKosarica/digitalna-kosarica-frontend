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
      {
        protocol: "https",
        hostname: "mercatoronline.si",
      },
      {
        protocol: "https",
        hostname: "dm.emea.cms.aldi.cx",
      },
    ],
  },
};

export default nextConfig;
