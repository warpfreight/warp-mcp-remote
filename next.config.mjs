/** @type {import('next').NextConfig} */
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
};

export default nextConfig;
