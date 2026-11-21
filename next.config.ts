import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The content bank is read from disk at runtime by the TOEFL content routes.
  outputFileTracingIncludes: {
    "/api/toefl/**": ["./content/bank/**/*.json"],
  },
};

export default nextConfig;
