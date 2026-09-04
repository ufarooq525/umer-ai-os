import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' || process.platform !== 'win32' ? 'standalone' : undefined,
  transpilePackages: ['@umer/config', '@umer/ui', '@umer/db', '@umer/contracts', '@umer/opportunity-intelligence'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  devIndicators: false,
};

export default nextConfig;
