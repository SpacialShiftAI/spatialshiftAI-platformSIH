/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // SWC minify of transpiled maplibre-gl collides with webpack's `h` require
  // helper and throws ReferenceError: h is not defined in production.
  swcMinify: false,
  transpilePackages: ['maplibre-gl'],
  webpack: (config, { dev }) => {
    if (!dev) {
      config.optimization.minimize = false;
    }
    return config;
  },
};

module.exports = nextConfig;
