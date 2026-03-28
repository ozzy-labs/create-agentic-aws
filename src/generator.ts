import { mergeFile, mergeMarkdown } from "./merge.js";
import type {
  IacPresetName,
  MarkdownSection,
  McpServerConfig,
  Preset,
  PresetName,
  WizardAnswers,
} from "./types.js";
import { GenerateResult } from "./types.js";

// ---------------------------------------------------------------------------
// Canonical preset application order
// ---------------------------------------------------------------------------

// Ensures deterministic preset composition — later presets can rely on earlier ones' files.
const PRESET_ORDER: readonly PresetName[] = [
  "base",
  "typescript",
  "python",
  "amazon-q",
  "claude-code",
  "copilot",
  "cdk",
  "terraform",
  "lambda",
  "ecs",
  "eks",
  "ec2",
  "vpc",
  "s3",
  "dynamodb",
  "aurora",
  "rds",
  "sqs",
  "sns",
  "eventbridge",
  "step-functions",
  "api-gateway",
  "cloudfront",
  "cognito",
  "cloudwatch",
];

// Presets that auto-resolve VPC
const VPC_TRIGGERS: ReadonlySet<PresetName> = new Set(["ecs", "eks", "ec2", "aurora", "rds"]);

// ---------------------------------------------------------------------------
// Preset resolution
// ---------------------------------------------------------------------------

export function resolvePresets(
  answers: WizardAnswers,
  registry: ReadonlyMap<PresetName, Preset>,
): Preset[] {
  const selected = new Set<PresetName>();

  // Always include base
  selected.add("base");

  // Collect from wizard answers
  for (const name of answers.languages) selected.add(name);
  for (const name of answers.agents) selected.add(name);
  selected.add(answers.iac);
  for (const name of answers.compute) selected.add(name);
  for (const name of answers.data) selected.add(name);
  for (const name of answers.integration) selected.add(name);
  for (const name of answers.networking) selected.add(name);
  for (const name of answers.security) selected.add(name);
  for (const name of answers.observability) selected.add(name);

  // Auto-resolve VPC
  for (const name of selected) {
    if (VPC_TRIGGERS.has(name)) {
      selected.add("vpc");
      break;
    }
  }
  if (answers.lambdaOptions?.vpcPlacement) {
    selected.add("vpc");
  }

  // Resolve transitive dependencies (requires)
  const resolved = new Set<PresetName>(selected);
  for (const name of selected) {
    const preset = registry.get(name);
    if (preset?.requires) {
      for (const dep of preset.requires) {
        resolved.add(dep);
      }
    }
  }

  // Sort by canonical order
  return PRESET_ORDER.filter((name) => resolved.has(name))
    .map((name) => registry.get(name))
    .filter((p): p is Preset => p !== undefined);
}

// ---------------------------------------------------------------------------
// Variable substitution
// ---------------------------------------------------------------------------

function substituteVars(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

function defaultEmptyContent(path: string): string {
  if (path.endsWith(".json") || path.endsWith(".jsonc")) return "{}";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "";
  if (path.endsWith(".toml")) return "";
  return "";
}

// ---------------------------------------------------------------------------
// Generator pipeline
// ---------------------------------------------------------------------------

export function generate(
  answers: WizardAnswers,
  registry: ReadonlyMap<PresetName, Preset>,
): GenerateResult {
  const presets = resolvePresets(answers, registry);
  const vars = { projectName: answers.projectName };
  const files = new Map<string, string>();

  // --- Step 1: Collect owned files (with variable substitution) ---
  for (const preset of presets) {
    for (const [path, content] of Object.entries(preset.files)) {
      files.set(path, substituteVars(content, vars));
    }
  }

  // --- Step 2: IaC contributions ---
  collectIacContributions(presets, answers.iac, files, vars);

  // --- Step 3: Shared file deep merge ---
  mergeSharedFiles(presets, files, vars);

  // --- Step 4: MCP server distribution ---
  distributeMcpServers(presets, answers, files);

  // --- Step 5: Markdown template expansion ---
  expandMarkdownTemplates(presets, files);

  return new GenerateResult(files);
}

// ---------------------------------------------------------------------------
// Step 2: IaC contributions
// ---------------------------------------------------------------------------

function collectIacContributions(
  presets: readonly Preset[],
  iac: IacPresetName,
  files: Map<string, string>,
  vars: Record<string, string>,
): void {
  // Collect IaC merge contributions grouped by path
  const iacMergeContributions = new Map<string, unknown[]>();

  for (const preset of presets) {
    const contribution = preset.iacContributions?.[iac];
    if (!contribution) continue;

    // Add IaC owned files
    for (const [path, content] of Object.entries(contribution.files)) {
      files.set(path, substituteVars(content, vars));
    }

    // Collect IaC merge contributions
    if (contribution.merge) {
      for (const [path, patch] of Object.entries(contribution.merge)) {
        const existing = iacMergeContributions.get(path) ?? [];
        existing.push(patch);
        iacMergeContributions.set(path, existing);
      }
    }
  }

  // Apply IaC merge contributions
  for (const [path, patches] of iacMergeContributions) {
    const base = files.get(path) ?? defaultEmptyContent(path);
    files.set(path, mergeFile(path, base, patches));
  }
}

// ---------------------------------------------------------------------------
// Step 3: Shared file deep merge
// ---------------------------------------------------------------------------

function mergeSharedFiles(
  presets: readonly Preset[],
  files: Map<string, string>,
  vars: Record<string, string>,
): void {
  // Group merge contributions by file path
  const contributions = new Map<string, unknown[]>();

  for (const preset of presets) {
    for (const [path, patch] of Object.entries(preset.merge)) {
      const existing = contributions.get(path) ?? [];
      existing.push(patch);
      contributions.set(path, existing);
    }
  }

  // Apply merge contributions
  for (const [path, patches] of contributions) {
    const base = files.get(path) ?? defaultEmptyContent(path);
    const merged = mergeFile(path, substituteVars(base, vars), patches);
    files.set(path, merged);
  }
}

// ---------------------------------------------------------------------------
// Step 4: MCP server distribution
// ---------------------------------------------------------------------------

/** Agent config file paths where MCP servers are registered. */
const AGENT_MCP_PATHS: Readonly<Record<string, string>> = {
  "claude-code": ".mcp.json",
  "amazon-q": ".amazonq/mcp.json",
  copilot: ".github/copilot-mcp.json",
};

function distributeMcpServers(
  presets: readonly Preset[],
  answers: WizardAnswers,
  files: Map<string, string>,
): void {
  // Collect all MCP servers from all presets
  const allServers: Record<string, McpServerConfig> = {};
  for (const preset of presets) {
    if (preset.mcpServers) {
      Object.assign(allServers, preset.mcpServers);
    }
  }

  if (Object.keys(allServers).length === 0) return;

  // Distribute to each selected agent's config
  for (const agent of answers.agents) {
    const configPath = AGENT_MCP_PATHS[agent];
    if (!configPath) continue;

    const raw = files.get(configPath);
    const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

    const merged = {
      ...existing,
      mcpServers: {
        ...((existing.mcpServers as Record<string, unknown>) ?? {}),
        ...allServers,
      },
    };

    files.set(configPath, `${JSON.stringify(merged, null, 2)}\n`);
  }
}

// ---------------------------------------------------------------------------
// Step 5: Markdown template expansion
// ---------------------------------------------------------------------------

function expandMarkdownTemplates(presets: readonly Preset[], files: Map<string, string>): void {
  // Group markdown sections by file path
  const sectionsByPath = new Map<string, MarkdownSection[]>();

  for (const preset of presets) {
    if (!preset.markdown) continue;
    for (const [path, sections] of Object.entries(preset.markdown)) {
      const existing = sectionsByPath.get(path) ?? [];
      existing.push(...sections);
      sectionsByPath.set(path, existing);
    }
  }

  // Apply sections to each markdown file
  for (const [path, sections] of sectionsByPath) {
    const template = files.get(path) ?? "";
    files.set(path, mergeMarkdown(template, sections));
  }
}
