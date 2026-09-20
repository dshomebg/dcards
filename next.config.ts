import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Самостоятелен изход: образът носи само нужното от `node_modules`, а deploy-ът
  // качва tar през scp — разликата е гигабайти срещу стотици мегабайти.
  output: 'standalone',
  // Логото е до 2 MB, а multipart добавя отгоре; таванът на action-ите е 1 MB.
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
};

export default nextConfig;
