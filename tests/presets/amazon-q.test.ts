import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator/index.js";
import { createAmazonQPreset } from "../../src/presets/amazon-q.js";
import { createBasePreset } from "../../src/presets/base.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: ["amazon-q"],
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

describe("amazon-q preset", () => {
  const aq = createAmazonQPreset();

  it("has name 'amazon-q'", () => {
    expect(aq.name).toBe("amazon-q");
  });

  it("includes project rules template", () => {
    expect(aq.files[".amazonq/rules/project.md"]).toBeDefined();
    expect(aq.files[".amazonq/rules/project.md"]).toContain("Project Rules");
  });

  it("project rules include commit convention and branching", () => {
    const rules = aq.files[".amazonq/rules/project.md"];
    expect(rules).toContain("Commit Convention");
    expect(rules).toContain("Conventional Commits");
    expect(rules).toContain("Branching");
    expect(rules).toContain("squash merge only");
  });

  it("registers shared MCP servers", () => {
    expect(aq.mcpServers?.context7).toBeDefined();
    expect(aq.mcpServers?.fetch).toBeDefined();
  });

  describe("integration with generator", () => {
    it("generates .amazonq/rules/project.md", () => {
      const registry = makeRegistry(createBasePreset(), cdkStub, aq);
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile(".amazonq/rules/project.md")).toBe(true);
    });

    it("distributes MCP servers to .amazonq/mcp.json", () => {
      const registry = makeRegistry(createBasePreset(), cdkStub, aq);
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile(".amazonq/mcp.json")).toBe(true);
      const config = result.readJson<{ mcpServers: Record<string, unknown> }>(".amazonq/mcp.json");
      expect(config.mcpServers.context7).toBeDefined();
      expect(config.mcpServers.fetch).toBeDefined();
      // Also includes base's aws-documentation
      expect(config.mcpServers["aws-documentation"]).toBeDefined();
    });
  });
});
