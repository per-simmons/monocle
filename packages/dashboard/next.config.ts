import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Proxy API requests to the Monocle server
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:7200/api/:path*',
      },
    ];
  },
};

export default nextConfig;
