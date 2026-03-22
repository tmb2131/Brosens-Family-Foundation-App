/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@supabase/supabase-js",
      "radix-ui",
      "sonner"
    ],
  },
  compress: true,
  images: {
    formats: ['image/webp', 'image/avif'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['info'] }
      : false,
  },
};

export default nextConfig;
