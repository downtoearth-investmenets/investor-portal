import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gatewayUrl = process.env.API_GATEWAY_URL?.trim();
if (process.env.VERCEL === '1' && !gatewayUrl) {
  throw new Error('Set API_GATEWAY_URL to the Render API origin before deploying the frontend.');
}
const gateway = new URL(gatewayUrl || 'http://127.0.0.1:4000');
if (!['http:', 'https:'].includes(gateway.protocol) || gateway.username || gateway.password ||
    gateway.pathname !== '/' || gateway.search || gateway.hash) {
  throw new Error('API_GATEWAY_URL must be an HTTP(S) origin without credentials or a path.');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: gateway.origin + '/api/:path*',
      },
    ];
  },
};

export default nextConfig;

