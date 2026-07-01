/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@tina/database"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.discordapp.com" }],
  },
};

export default nextConfig;
