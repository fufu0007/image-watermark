/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
      };
    }
    
    if (isServer) {
      config.externals = [...(config.externals || []), 'sharp'];
    }

    return config;
  },
  // 禁用页面优化以排除构建问题
  optimizeFonts: false,
  typescript: {
    // 在开发时忽略类型错误
    ignoreBuildErrors: true,
  },
  eslint: {
    // 在开发时忽略 ESLint 错误
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  // 确保生成正确的构建清单
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
};

module.exports = nextConfig; 