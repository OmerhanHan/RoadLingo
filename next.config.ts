import type { NextConfig } from "next";

const isMobileExport = process.env.MOBILE_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isMobileExport ? { output: "export" } : {}),
  images: {
    unoptimized: true,
  },
  // Dev-only badge; bottom-left would cover the sidebar's plan card on desktop.
  devIndicators: { position: "bottom-right" },
  // The content bank is read from disk at runtime by the TOEFL content routes.
  outputFileTracingIncludes: {
    "/api/toefl/**": ["./content/bank/**/*.json"],
  },
};

export default nextConfig;
