import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server is bound on 0.0.0.0 and opened at 127.0.0.1. Next blocks
  // the HMR socket for that host unless it is listed, and hydration waits on
  // that socket in development.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
