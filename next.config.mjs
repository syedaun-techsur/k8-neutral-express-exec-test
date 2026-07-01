// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  // Intentionally no headers() override — Next.js 14 does not inject
  // X-Frame-Options or frame-ancestors CSP by default when no custom
  // headers are defined. The app must render inside a cross-origin iframe
  // (F9 / US-9.1). An empty headers array causes a hard error in Next 14.
};

export default nextConfig;
