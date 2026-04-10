import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // Read BACKEND_URL from Docker env, fallback to localhost:5000 if running locally outside docker
        destination: `${process.env.BACKEND_URL || 'http://localhost:5000/api'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
