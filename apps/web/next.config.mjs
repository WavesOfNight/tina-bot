/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@tina/database"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.discordapp.com" }],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
