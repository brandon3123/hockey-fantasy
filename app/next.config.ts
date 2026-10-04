import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API routes return user- and draft-specific data; without this, browsers
  // can heuristically cache GET responses and serve stale drafts/standings
  // until a manual refresh.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
