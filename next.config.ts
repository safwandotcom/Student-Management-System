import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local Supabase (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SITE_URL) deliberately uses
  // 127.0.0.1 so invite/auth redirect links land on the same host Supabase issued the
  // session for. The Next.js 16 Turbopack dev server's cross-origin dev-resource guard
  // only trusts its own advertised "Local" host (localhost) by default, so it returns a
  // 403 for the JS chunk requests made from a 127.0.0.1 tab — the app's own bundle never
  // loads, the page never hydrates, and client effects (e.g. accept-invite's
  // verifyInvite) never run. It isn't silent server-side: the dev server logs a warning
  // naming allowedDevOrigins, but the browser sees a failed page load with no
  // client-side error. Allow 127.0.0.1 explicitly so dev-mode chunk/HMR requests from
  // that origin succeed. See:
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
