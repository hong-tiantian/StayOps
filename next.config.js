/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // MCP SDK spawns a child process (phoenix-mcp); keep it out of the bundle.
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
};

module.exports = nextConfig;
