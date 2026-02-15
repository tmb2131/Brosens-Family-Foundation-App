/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@supabase/supabase-js",
      "radix-ui",
      "sonner"
    ],
  },
};

export default nextConfig;
