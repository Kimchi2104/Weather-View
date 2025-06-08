const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // This is the port that Genkit is running on.
    allowedDevOrigins: [
      'http://localhost:10001',
      'https://9003-firebase-studio-1748936635700.cluster-ys234awlzbhwoxmkkse6qo3fz6.cloudworkstations.dev',
    ],
  },
  output: 'standalone',
};

module.exports = nextConfig;
