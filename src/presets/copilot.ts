import type { Preset } from "../types.js";
import { SHARED_MCP_SERVERS } from "./shared.js";
import { readTemplates } from "./templates.js";

export function createCopilotPreset(): Preset {
  const templates = readTemplates("copilot");

  return {
    name: "copilot",

    files: {
      ...templates,
    },

    merge: {},

    mcpServers: {
      ...SHARED_MCP_SERVERS,
    },

    markdown: {
      ".github/copilot-instructions.md": [
        {
          heading: "## Project Overview",
          content: "Use GitHub Copilot to assist with development tasks in this project.",
        },
      ],
    },
  };
}
