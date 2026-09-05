/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    transpilePackages: ['maplibre-gl'],
  },
};

module.exports = nextConfig;
