/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle ES modules compatibility on server side
      config.externals = config.externals || [];
      config.externals.push({
        'cheerio': 'cheerio',
        'mammoth': 'mammoth',
        'papaparse': 'papaparse'
      });
    }
    return config;
  },
};

export default nextConfig;
