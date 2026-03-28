import type { Preset } from "../types.js";
import { SHARED_MCP_SERVERS } from "./shared.js";
import { readTemplates } from "./templates.js";

export function createAmazonQPreset(): Preset {
  const templates = readTemplates("amazon-q");

  return {
    name: "amazon-q",

    files: {
      ...templates,
    },

    merge: {},

    mcpServers: {
      ...SHARED_MCP_SERVERS,
    },

    markdown: {
      ".amazonq/rules/project.md": [
        {
          heading: "## Overview",
          content: "Follow the project rules and conventions defined in this file.",
        },
      ],
    },
  };
}
