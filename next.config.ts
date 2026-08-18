import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: "/",
        destination: "/tools/esop-pool-size",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
