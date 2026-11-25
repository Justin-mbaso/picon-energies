import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i0.wp.com", pathname: "/flx.ng/wp-content/uploads/**" },
      { protocol: "https", hostname: "solarvillage.africa", pathname: "/media/catalog/product/**" },
      { protocol: "https", hostname: "inverterdeye.vn", pathname: "/wp-content/uploads/**" },
      { protocol: "https", hostname: "deye.com", pathname: "/wp-content/uploads/**" },
    ],
  },
};

export default nextConfig;
