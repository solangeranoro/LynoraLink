import "./scripts/load-root-env.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? (process.env.NODE_ENV === "production" ? ".next-production" : ".next"),
};

export default nextConfig;