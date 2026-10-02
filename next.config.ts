import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Allow JSON imports for demo data
  experimental: {},
  // TypeScript strict mode is in tsconfig.json

  // Ensure API routes are not cached by default
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },

  // Rewrites not needed — all routes are in /app
};

export default nextConfig;
