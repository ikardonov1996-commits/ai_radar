import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Card images come from many hosts (App Store, Google Play, og:image of any site),
  // so we render plain <img> and skip the image optimizer.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
