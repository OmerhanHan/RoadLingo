import type { NextConfig } from "next";

const isMobileExport = process.env.MOBILE_EXPORT === "1";
const isDev = process.env.NODE_ENV === "development";

/** The Supabase project the browser talks to (auth, and later data). */
function supabaseOrigins(): string[] {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return [url.origin, `wss://${url.host}`];
  } catch {
    return [];
  }
}

/**
 * Content Security Policy without nonces: pages stay static (and the mobile
 * export keeps working), so inline scripts are allowed; everything else is
 * limited to this site, Google Fonts and Supabase. Dev needs 'unsafe-eval'
 * for React's debugging and ws: for hot reload.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  ["connect-src 'self'", ...supabaseOrigins(), ...(isDev ? ["ws:"] : [])].join(" "),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The speaking pages record from the microphone; nothing uses the rest.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  ...(isMobileExport ? { output: "export" } : {}),
  images: {
    unoptimized: true,
  },
  // Dev-only badge; bottom-left would cover the sidebar's plan card on desktop.
  devIndicators: { position: "bottom-right" },
  // Headers do not apply to a static export (the app shell sets its own).
  ...(isMobileExport
    ? {}
    : {
        async headers() {
          return [{ source: "/:path*", headers: securityHeaders }];
        },
      }),
  // The content bank is read from disk at runtime by the content routes.
  outputFileTracingIncludes: {
    "/api/toefl/**": ["./content/bank/**/*.json"],
    "/api/games/**": ["./content/bank/**/*.json"],
  },
};

export default nextConfig;
