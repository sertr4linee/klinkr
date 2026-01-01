/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Disable Turbopack, use Webpack instead
  bundler: 'webpack',
  // Permettre les connexions WebSocket locales
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};

export default nextConfig;
