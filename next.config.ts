import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Самостоятелен изход: образът носи само нужното от `node_modules`, а deploy-ът
  // качва tar през scp — разликата е гигабайти срещу стотици мегабайти.
  output: 'standalone',
};

export default nextConfig;
