
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            // Set a policy that omits 'browsing-topics'.
            // Add other features your app might need, e.g., geolocation=(self)
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ];
  },
  allowedDevOrigins: [
      "https://6000-firebase-studio-1748936635700.cluster-ys234awlzbhwoxmkkse6qo3fz6.cloudworkstations.dev"
  ]
};

export default nextConfig;
