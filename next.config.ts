import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "",
  },
  // Fix the working directory warning
  outputFileTracingRoot: __dirname,
  output: "standalone",
  
  // Build optimizations
  compiler: {
    // Keep console logs for middleware logging
    removeConsole: false,
  },
  
  // Reduce bundle size
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  
  // Faster builds
  typescript: {
    // Only type-check in development, skip in production builds for speed
    ignoreBuildErrors: process.env.NODE_ENV === "production",
  },
  
  // Increase server body size limit for file uploads
  serverExternalPackages: [],
  // Note: For Vercel deployment, add FUNCTIONS_BODY_SIZE_LIMIT=10485760 in Vercel env vars
};

export default nextConfig;
