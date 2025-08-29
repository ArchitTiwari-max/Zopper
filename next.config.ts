import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix the working directory warning
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
