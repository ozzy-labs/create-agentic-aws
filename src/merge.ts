import { deepmergeCustom } from "deepmerge-ts";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import type { MarkdownSection } from "./types.js";

// ---------------------------------------------------------------------------
// Deep merge with unique union arrays (for JSON / YAML)
// ---------------------------------------------------------------------------

const deepMergeUnion = deepmergeCustom({
  mergeArrays(values) {
    const seen = new Set<string>();
    const result: unknown[] = [];
    for (const arr of values) {
      for (const item of arr) {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      }
    }
    return result;
  },
});

// ---------------------------------------------------------------------------
// JSON merge
// ---------------------------------------------------------------------------

export function mergeJson(base: string, ...patches: Record<string, unknown>[]): string {
  if (patches.length === 0) return base;
  const baseObj = JSON.parse(base) as Record<string, unknown>;
  const merged = deepMergeUnion(baseObj, ...patches) as Record<string, unknown>;
  return `${JSON.stringify(merged, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// YAML merge
// ---------------------------------------------------------------------------

export function mergeYaml(base: string, ...patches: Record<string, unknown>[]): string {
  if (patches.length === 0) return base;
  const baseObj = (parseYaml(base) as Record<string, unknown>) ?? {};
  const merged = deepMergeUnion(baseObj, ...patches) as Record<string, unknown>;
  return stringifyYaml(merged, { lineWidth: 0 });
}

// ---------------------------------------------------------------------------
// TOML merge (no special array handling — TOML arrays are less common)
// ---------------------------------------------------------------------------

const deepMergeDefault = deepmergeCustom({});

export function mergeToml(base: string, ...patches: Record<string, unknown>[]): string {
  if (patches.length === 0) return base;
  const baseObj = (base.trim() ? parseToml(base) : {}) as Record<string, unknown>;
  const merged = deepMergeDefault(baseObj, ...patches) as Record<string, unknown>;
  return stringifyToml(merged);
}

// ---------------------------------------------------------------------------
// Text merge (block append + line dedup, e.g. .gitignore)
// ---------------------------------------------------------------------------

export function mergeText(base: string, ...blocks: string[]): string {
  if (blocks.length === 0) return base;

  const seen = new Set<string>();
  const result: string[] = [];

  // Process base lines
  for (const line of base.split("\n")) {
    if (line === "" || !seen.has(line)) {
      if (line !== "") seen.add(line);
      result.push(line);
    }
  }

  // Append each block, separated by blank line
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l !== "" && !seen.has(l));
    if (lines.length > 0) {
      // Ensure blank line separator
      if (result.length > 0 && result[result.length - 1] !== "") {
        result.push("");
      }
      for (const line of lines) {
        seen.add(line);
        result.push(line);
      }
    }
  }

  // Ensure trailing newline
  const text = result.join("\n");
  return text.endsWith("\n") ? text : `${text}\n`;
}

// ---------------------------------------------------------------------------
// Markdown merge (template + section injection)
// ---------------------------------------------------------------------------

export function mergeMarkdown(template: string, sections: readonly MarkdownSection[]): string {
  if (sections.length === 0) return template;

  let result = template;

  for (const section of sections) {
    result = injectMarkdownSection(result, section);
  }

  return result;
}

function injectMarkdownSection(template: string, section: MarkdownSection): string {
  const lines = template.split("\n");
  const headingLevel = getHeadingLevel(section.heading);
  const headingIndex = lines.findIndex((line) => line.trim() === section.heading.trim());

  if (headingIndex === -1) {
    // Heading not found — append section at end
    const suffix = `\n${section.heading}\n\n${section.content}\n`;
    return template.endsWith("\n") ? `${template}${suffix}` : `${template}\n${suffix}`;
  }

  // Find the end of this section (next heading of same or higher level)
  let insertIndex = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const level = getHeadingLevel(lines[i]);
    if (level > 0 && level <= headingLevel) {
      insertIndex = i;
      break;
    }
  }

  // Insert content before the next section (with blank line)
  const contentLines = section.content.split("\n");
  const injection = ["", ...contentLines];

  // Remove trailing blank lines before injection point
  while (insertIndex > headingIndex + 1 && lines[insertIndex - 1]?.trim() === "") {
    insertIndex--;
  }

  lines.splice(insertIndex, 0, ...injection, "");

  return lines.join("\n");
}

function getHeadingLevel(line: string): number {
  const match = /^(#{1,6})\s/.exec(line.trim());
  return match ? match[1].length : 0;
}

// ---------------------------------------------------------------------------
// HCL merge (template + block injection for variables.tf, outputs.tf)
// ---------------------------------------------------------------------------

export function mergeHcl(template: string, ...blocks: string[]): string {
  if (blocks.length === 0) return template;

  let result = template.trimEnd();

  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed !== "") {
      result = `${result}\n\n${trimmed}`;
    }
  }

  return `${result}\n`;
}

// ---------------------------------------------------------------------------
// TypeScript merge (marker-based injection for shared .ts files)
// ---------------------------------------------------------------------------

/**
 * Merges contributions into a TypeScript template using comment markers.
 *
 * Templates contain markers like `// [merge: imports]` and `// [merge: constructs]`.
 * Each contribution is a `Record<string, string>` mapping marker names to code blocks.
 * Code is injected after the corresponding marker comment.
 */
export function mergeTypeScript(base: string, ...patches: Record<string, string>[]): string {
  if (patches.length === 0) return base;

  // Accumulate code per marker
  const accumulated = new Map<string, string[]>();
  for (const patch of patches) {
    for (const [marker, code] of Object.entries(patch)) {
      const existing = accumulated.get(marker) ?? [];
      existing.push(code);
      accumulated.set(marker, existing);
    }
  }

  let result = base;
  for (const [marker, codes] of accumulated) {
    const markerComment = `// [merge: ${marker}]`;
    const index = result.indexOf(markerComment);
    if (index === -1) continue;

    const lineEnd = result.indexOf("\n", index);
    const insertAt = lineEnd === -1 ? result.length : lineEnd + 1;

    const injection = `${codes.join("\n")}\n`;
    result = result.slice(0, insertAt) + injection + result.slice(insertAt);
  }

  return result;
}

// ---------------------------------------------------------------------------
// File path dispatcher
// ---------------------------------------------------------------------------

export function mergeFile(path: string, base: string, contributions: unknown[]): string {
  if (contributions.length === 0) return base;

  if (path.endsWith(".json") || path.endsWith(".jsonc")) {
    return mergeJson(base, ...(contributions as Record<string, unknown>[]));
  }

  if (path.endsWith(".yaml") || path.endsWith(".yml")) {
    return mergeYaml(base, ...(contributions as Record<string, unknown>[]));
  }

  if (path.endsWith(".toml")) {
    return mergeToml(base, ...(contributions as Record<string, unknown>[]));
  }

  if (path.endsWith(".tf")) {
    return mergeHcl(base, ...(contributions as string[]));
  }

  if (path.endsWith(".md")) {
    return mergeMarkdown(base, contributions as MarkdownSection[]);
  }

  if (path.endsWith(".ts")) {
    return mergeTypeScript(base, ...(contributions as Record<string, string>[]));
  }

  // Default: text merge (e.g. .gitignore)
  return mergeText(base, ...(contributions as string[]));
}
