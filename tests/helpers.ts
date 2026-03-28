import { expect } from "vitest";

import { generate } from "../src/generator.js";
import { createRegistry } from "../src/presets/registry.js";
import type { GenerateResult, PresetName, WizardAnswers } from "../src/types.js";

// ---------------------------------------------------------------------------
// Default answers factory
// ---------------------------------------------------------------------------

export function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "test-project",
    agents: [],
    iac: "cdk",
    compute: [],
    data: [],
    integration: [],
    networking: [],
    security: [],
    observability: [],
    languages: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Registry + generate shortcut
// ---------------------------------------------------------------------------

const registry = createRegistry();

export function generateProject(overrides: Partial<WizardAnswers> = {}): GenerateResult {
  return generate(makeAnswers(overrides), registry);
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/** Assert all .json files in the result are valid JSON. */
export function expectAllJsonValid(result: GenerateResult): void {
  for (const [path, content] of result.files) {
    if (path.endsWith(".json") || path.endsWith(".jsonc")) {
      expect(() => JSON.parse(content), `Invalid JSON in ${path}`).not.toThrow();
    }
  }
}

/** Assert no files contain leftover {{...}} placeholders. */
export function expectNoLeftoverPlaceholders(result: GenerateResult): void {
  for (const [path, content] of result.files) {
    const match = /\{\{(\w+)\}\}/.exec(content);
    expect(match, `Leftover placeholder {{${match?.[1]}}} in ${path}`).toBeNull();
  }
}

/** Assert that specific presets' owned files are present. */
export function expectPresetsIncluded(result: GenerateResult, presetNames: PresetName[]): void {
  const presets = presetNames.map((n) => registry.get(n)).filter(Boolean);
  for (const preset of presets) {
    if (!preset) continue;
    for (const path of Object.keys(preset.files)) {
      expect(result.hasFile(path), `Missing file ${path} from preset ${preset.name}`).toBe(true);
    }
  }
}

/** Assert that specific files do NOT exist (e.g. wrong IaC files). */
export function expectFilesAbsent(result: GenerateResult, paths: string[]): void {
  for (const path of paths) {
    expect(result.hasFile(path), `Unexpected file ${path}`).toBe(false);
  }
}
