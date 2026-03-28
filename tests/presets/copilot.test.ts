import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator/index.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCopilotPreset } from "../../src/presets/copilot.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: ["copilot"],
    iac: "cdk",
    compute: [],
    ai: [],
    data: [],
    integration: [],
    networking: [],
    security: [],
    observability: [],
    languages: [],
    ...overrides,
  };
}

const cdkStub: Preset = { name: "cdk", files: {}, merge: {} };

function makeRegistry(...presets: Preset[]): Map<PresetName, Preset> {
  return new Map(presets.map((p) => [p.name, p]));
}

describe("copilot preset", () => {
  const cp = createCopilotPreset();

  it("has name 'copilot'", () => {
    expect(cp.name).toBe("copilot");
  });

  it("includes copilot instructions template", () => {
    expect(cp.files[".github/copilot-instructions.md"]).toBeDefined();
    expect(cp.files[".github/copilot-instructions.md"]).toContain("Copilot Instructions");
  });

  it("registers shared MCP servers", () => {
    expect(cp.mcpServers?.context7).toBeDefined();
    expect(cp.mcpServers?.fetch).toBeDefined();
  });

  describe("integration with generator", () => {
    it("generates .github/copilot-instructions.md", () => {
      const registry = makeRegistry(createBasePreset(), cdkStub, cp);
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile(".github/copilot-instructions.md")).toBe(true);
    });

    it("distributes MCP servers to .github/copilot-mcp.json", () => {
      const registry = makeRegistry(createBasePreset(), cdkStub, cp);
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile(".github/copilot-mcp.json")).toBe(true);
      const config = result.readJson<{ mcpServers: Record<string, unknown> }>(
        ".github/copilot-mcp.json",
      );
      expect(config.mcpServers.context7).toBeDefined();
      expect(config.mcpServers.fetch).toBeDefined();
    });
  });
});
