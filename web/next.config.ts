import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // In development, proxy CRM requests to Vite dev server
    // In production, serve from built CRM assets
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
      return [
        {
          source: '/crm-vite/:path*',
          destination: 'http://localhost:5174/:path*',
        },
      ];
    }

    return [];
  },
};

export default nextConfig;
