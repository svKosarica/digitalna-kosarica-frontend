import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The catalogue is ~53k listings across six store CDNs and nearly every one
    // is viewed once, so Vercel's optimizer got no cache reuse and billed a
    // transformation per listing. It exhausted the monthly allowance and began
    // answering every /_next/image with 402 — remote and local alike — which
    // tripped ProductImage's onError and turned the whole site into fallback
    // icons. Serving straight from source keeps a metered resource out of the
    // render path entirely, so catalogue growth cannot break images again.
    //
    // Interspar (~half the catalogue) additionally 403s every datacenter IP, so
    // its images can only ever be fetched by the visitor's own browser. That
    // rules out any server-side proxy, Vercel's or our own.
    unoptimized: true,
    // Inert while unoptimized is set. Kept because it documents the six hosts
    // the catalogue actually serves from, and re-enabling optimization later
    // should be a one-line change rather than an archaeology exercise.
    //
    // It used to also be an allowlist: an unknown host threw in dev and 400'd
    // in production. With unoptimized set, that check never runs — any host
    // the API returns is fetched straight by visitors' browsers, with no
    // error, no build failure, and nothing surfacing anywhere. If the API
    // starts returning a seventh host, or the known-malformed
    // `https:/spar.logo.si` row (browsers normalize the missing slash to
    // `https://spar.logo.si` and request it anyway), nothing will flag it.
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
