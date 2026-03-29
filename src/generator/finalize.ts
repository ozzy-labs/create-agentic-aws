import { mergeFile, mergeMarkdown } from "../merge.js";
import type {
  IacPresetName,
  MarkdownSection,
  McpServerConfig,
  Preset,
  WizardAnswers,
} from "../types.js";
import { defaultEmptyContent, substituteVars } from "./helpers.js";

// ---------------------------------------------------------------------------
// IaC contributions
// ---------------------------------------------------------------------------

export function collectIacContributions(
  presets: readonly Preset[],
  iac: IacPresetName,
  files: Map<string, string>,
  vars: Record<string, string>,
): void {
  const iacMergeContributions = new Map<string, unknown[]>();

  for (const preset of presets) {
    const contribution = preset.iacContributions?.[iac];
    if (!contribution) continue;

    for (const [path, content] of Object.entries(contribution.files)) {
      files.set(path, substituteVars(content, vars));
    }

    if (contribution.merge) {
      for (const [path, patch] of Object.entries(contribution.merge)) {
        const existing = iacMergeContributions.get(path) ?? [];
        existing.push(patch);
        iacMergeContributions.set(path, existing);
      }
    }
  }

  for (const [path, patches] of iacMergeContributions) {
    const base = files.get(path) ?? defaultEmptyContent(path);
    files.set(path, mergeFile(path, base, patches));
  }
}

// ---------------------------------------------------------------------------
// Shared file deep merge
// ---------------------------------------------------------------------------

export function mergeSharedFiles(
  presets: readonly Preset[],
  files: Map<string, string>,
  vars: Record<string, string>,
): void {
  const contributions = new Map<string, unknown[]>();

  for (const preset of presets) {
    for (const [path, patch] of Object.entries(preset.merge)) {
      const existing = contributions.get(path) ?? [];
      existing.push(patch);
      contributions.set(path, existing);
    }
  }

  for (const [path, patches] of contributions) {
    const base = files.get(path) ?? defaultEmptyContent(path);
    const merged = mergeFile(path, substituteVars(base, vars), patches);
    files.set(path, merged);
  }
}

// ---------------------------------------------------------------------------
// MCP server distribution
// ---------------------------------------------------------------------------

const AGENT_MCP_PATHS: Readonly<Record<string, string>> = {
  "claude-code": ".mcp.json",
  "amazon-q": ".amazonq/mcp.json",
  copilot: ".github/copilot-mcp.json",
};

export function distributeMcpServers(
  presets: readonly Preset[],
  answers: WizardAnswers,
  files: Map<string, string>,
): void {
  const allServers: Record<string, McpServerConfig> = {};
  for (const preset of presets) {
    if (preset.mcpServers) {
      Object.assign(allServers, preset.mcpServers);
    }
  }

  if (Object.keys(allServers).length === 0) return;

  for (const agent of answers.agents) {
    if (agent === "claude-code") continue;
    const configPath = AGENT_MCP_PATHS[agent];
    if (!configPath) continue;

    const raw = files.get(configPath);
    let existing: Record<string, unknown> = {};
    if (raw) {
      try {
        existing = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        existing = {};
      }
    }

    const merged = {
      ...existing,
      mcpServers: {
        ...((existing.mcpServers as Record<string, unknown>) ?? {}),
        ...allServers,
      },
    };

    files.set(configPath, `${JSON.stringify(merged, null, 2)}\n`);
  }

  const example = { mcpServers: allServers };
  files.set(".mcp.json.example", `${JSON.stringify(example, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// Markdown template expansion
// ---------------------------------------------------------------------------

export function expandMarkdownTemplates(
  presets: readonly Preset[],
  files: Map<string, string>,
): void {
  const sectionsByPath = new Map<string, MarkdownSection[]>();

  for (const preset of presets) {
    if (!preset.markdown) continue;
    for (const [path, sections] of Object.entries(preset.markdown)) {
      const existing = sectionsByPath.get(path) ?? [];
      existing.push(...sections);
      sectionsByPath.set(path, existing);
    }
  }

  for (const [path, sections] of sectionsByPath) {
    const template = files.get(path);
    if (template === undefined) continue;
    files.set(path, mergeMarkdown(template, sections));
  }
}

// ---------------------------------------------------------------------------
// Strip merge markers
// ---------------------------------------------------------------------------

const MERGE_MARKER_RE = /^[ \t]*\/\/ \[merge: [^\]]+\]\n?/gm;

export function stripMergeMarkers(files: Map<string, string>): void {
  for (const [path, content] of files) {
    if (path.endsWith(".ts") && MERGE_MARKER_RE.test(content)) {
      MERGE_MARKER_RE.lastIndex = 0;
      files.set(path, content.replace(MERGE_MARKER_RE, ""));
    }
  }
}
