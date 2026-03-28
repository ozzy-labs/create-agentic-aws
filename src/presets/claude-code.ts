import type { Preset } from "../types.js";
import { SHARED_MCP_SERVERS } from "./shared.js";
import { readTemplates } from "./templates.js";

export function createClaudeCodePreset(): Preset {
  const templates = readTemplates("claude-code");

  return {
    name: "claude-code",

    files: {
      ...templates,
    },

    merge: {
      ".gitignore": ".claude/settings.local.json\n.mcp.json\n",
      ".devcontainer/devcontainer.json": {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: devcontainer mount syntax
        mounts: ["source=${localEnv:HOME}/.claude,target=/home/vscode/.claude,type=bind,readonly"],
      },
    },

    mcpServers: {
      ...SHARED_MCP_SERVERS,
    },

    markdown: {
      "CLAUDE.md": [
        {
          heading: "## Project Overview",
          content: "Use Claude Code to assist with development tasks in this project.",
        },
      ],
    },
  };
}
