import type { NextConfig } from "next";

const isMobileExport = process.env.MOBILE_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isMobileExport ? { output: "export" } : {}),
  images: {
    unoptimized: true,
  },
  // The content bank is read from disk at runtime by the TOEFL content routes.
  outputFileTracingIncludes: {
    "/api/toefl/**": ["./content/bank/**/*.json"],
  },
};

export default nextConfig;
