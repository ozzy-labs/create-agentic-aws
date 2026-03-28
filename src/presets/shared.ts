import type { McpServerConfig } from "../types.js";

/** MCP servers shared across all agent presets. */
export const SHARED_MCP_SERVERS: Readonly<Record<string, McpServerConfig>> = {
  context7: {
    command: "npx",
    args: ["-y", "@upstash/context7-mcp@latest"],
  },
  fetch: {
    command: "uvx",
    args: ["mcp-server-fetch"],
  },
};
