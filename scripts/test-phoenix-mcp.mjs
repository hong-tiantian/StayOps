// Verify StayOps can connect to the Arize Phoenix MCP server and call a tool.
// Run: node --env-file=.env.local scripts/test-phoenix-mcp.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const base = process.env.PHOENIX_COLLECTOR_ENDPOINT;
const apiKey = process.env.PHOENIX_API_KEY;
if (!base || !apiKey) {
  console.error("Missing PHOENIX_COLLECTOR_ENDPOINT or PHOENIX_API_KEY");
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "@arizeai/phoenix-mcp@latest", "--baseUrl", base, "--apiKey", apiKey],
  env: {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    npm_config_cache: "/tmp/npm-stayops-cache",
  },
});

const client = new Client({ name: "stayops-mcp-test", version: "1.0.0" });
await client.connect(transport);
console.log("✅ connected to @arizeai/phoenix-mcp");

const { tools } = await client.listTools();
console.log(`\n${tools.length} tools exposed (showing first 25):`);
for (const t of tools.slice(0, 25)) console.log("  -", t.name);

// Try a read-only tool to prove a real round-trip.
const candidate =
  tools.find((t) => /list.*project/i.test(t.name)) ||
  tools.find((t) => /list.*dataset/i.test(t.name)) ||
  tools.find((t) => /list/i.test(t.name)) ||
  tools[0];

if (candidate) {
  console.log(`\nCalling '${candidate.name}' ...`);
  try {
    const res = await client.callTool({ name: candidate.name, arguments: {} });
    console.log(JSON.stringify(res, null, 2).slice(0, 700));
  } catch (e) {
    console.log("call failed (may need args):", String(e).slice(0, 200));
  }
}

await client.close();
process.exit(0);
