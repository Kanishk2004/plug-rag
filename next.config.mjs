/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: true,
  },
  // Configure for Turbopack (default in Next.js 16)
  turbopack: {
    // Handle ES modules that should remain external
    resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
  serverExternalPackages: [
    'mammoth',
    'papaparse',
    'pdf2json',
    'tiktoken',
  ],
};

export default nextConfig;
