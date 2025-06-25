import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features for better performance
  experimental: {
    scrollRestoration: true,
  },
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 300,
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "connect-src 'self' *.supabase.co wss://*.supabase.co",
              "img-src 'self' data: blob:",
              "font-src 'self' https://fonts.gstatic.com",
              "manifest-src 'self'",
              "worker-src 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ];
  },

  // Configure PWA caching
  async rewrites() {
    return [
      {
        source: '/offline',
        destination: '/offline.html',
      },
    ];
  },

  // Optimize bundle
  webpack: (config, { dev, isServer }) => {
    // Security: Remove source maps in production
    if (!dev) {
      config.devtool = false;
    }

    // Optimize for production
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      };

      // Security: Minify and obfuscate in production
      config.optimization.minimize = true;
    }

    return config;
  },

  // Enable compression
  compress: true,
  
  // Enable React strict mode
  reactStrictMode: true,
  
  // Configure trailing slash behavior
  trailingSlash: false,
  
  // Disable source maps in production for security
  productionBrowserSourceMaps: false,
  
  // Security: Disable x-powered-by header
  poweredByHeader: false,
};

export default nextConfig;
