/** @type {import('next').NextConfig} */

// Customer-facing links from the Warp iMessage/SMS assistant (warp-hitch) are
// served on this Warp domain instead of the hosting provider's hostname:
// connect pages, booking-card previews, and the Warp sign-in callback.
const HITCH_ORIGIN = (process.env.HITCH_ORIGIN || "https://warp-hitch-production.up.railway.app").replace(/\/$/, "");

const nextConfig = {
  // Keep the ESM warp-agent-mcp package (and the MCP SDK) as runtime node modules
  // rather than bundling them, so their internal relative imports resolve cleanly.
  experimental: {
    serverComponentsExternalPackages: [
      "warp-agent-mcp",
      "mcp-handler",
      "@modelcontextprotocol/sdk",
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/c/:path*", destination: `${HITCH_ORIGIN}/c/:path*` },
        { source: "/card/:path*", destination: `${HITCH_ORIGIN}/card/:path*` },
        { source: "/oauth/warp/callback", destination: `${HITCH_ORIGIN}/oauth/warp/callback` },
        { source: "/pally.jpg", destination: `${HITCH_ORIGIN}/pally.jpg` },
      ],
    };
  },
};

export default nextConfig;
