import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * MCP client for the Arize Phoenix MCP server (@arizeai/phoenix-mcp).
 *
 * StayOps connects over stdio and lets the product query its OWN observability
 * data — projects, traces, datasets, experiments — at runtime. This is the
 * "self-introspection" use of a partner MCP: the agent system can look back at
 * how it has behaved. A single lazily-connected client is reused across requests.
 */

let clientPromise: Promise<Client> | null = null;

async function connect(): Promise<Client> {
  const base = process.env.PHOENIX_COLLECTOR_ENDPOINT;
  const apiKey = process.env.PHOENIX_API_KEY;
  if (!base || !apiKey) {
    throw new Error("Phoenix MCP not configured (PHOENIX_COLLECTOR_ENDPOINT / PHOENIX_API_KEY missing)");
  }
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@arizeai/phoenix-mcp@latest", "--baseUrl", base, "--apiKey", apiKey],
    // The default npm cache is root-owned on this machine; point npx elsewhere.
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      npm_config_cache: "/tmp/npm-stayops-cache",
    },
  });
  const client = new Client({ name: "stayops", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

/** Call a phoenix-mcp tool and return its text payload (JSON string for list tools). */
export async function phoenixCall(
  name: string,
  args: Record<string, unknown> = {}
): Promise<string> {
  if (!clientPromise) {
    clientPromise = connect().catch((err) => {
      clientPromise = null; // allow retry on next call
      throw err;
    });
  }
  const client = await clientPromise;
  const res = await client.callTool({ name, arguments: args });
  const content = (res.content ?? []) as Array<{ type: string; text?: string }>;
  return content.map((c) => c.text ?? "").join("\n");
}

/** Convenience: parse a list tool's JSON text payload. */
export async function phoenixCallJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  return JSON.parse(await phoenixCall(name, args)) as T;
}
