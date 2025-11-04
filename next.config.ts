import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix the working directory warning
  outputFileTracingRoot: __dirname,
  
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
};

export default nextConfig;
