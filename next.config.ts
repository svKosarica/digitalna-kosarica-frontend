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
        hostname: "www.lidl.si",
      },
      {
        protocol: "https",
        hostname: "mercatoronline.si",
      },
      {
        protocol: "https",
        hostname: "dm.emea.cms.aldi.cx",
      },
      {
        protocol: "https",
        hostname: "hitrinakup.com",
      },
      // Tuš serves from two hosts: hitrinakup.com for the regular catalogue and
      // www.tus.si for roughly half of its card-discount listings, so this one
      // only shows up once you browse ?cardDiscount=true.
      {
        protocol: "https",
        hostname: "www.tus.si",
      },
    ],
  },
};

export default nextConfig;
