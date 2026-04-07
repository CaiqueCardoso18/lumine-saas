/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['localhost', 'lumine.com.br'],
  },
};

module.exports = nextConfig;
