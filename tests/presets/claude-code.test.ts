import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createClaudeCodePreset } from "../../src/presets/claude-code.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: ["claude-code"],
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

const cdkStub: Preset = { name: "cdk", files: {}, merge: {} };

function makeRegistry(...presets: Preset[]): Map<PresetName, Preset> {
  return new Map(presets.map((p) => [p.name, p]));
}

describe("claude-code preset", () => {
  const cc = createClaudeCodePreset();

  it("has name 'claude-code'", () => {
    expect(cc.name).toBe("claude-code");
  });

  describe("owned files", () => {
    it("includes CLAUDE.md", () => {
      expect(cc.files["CLAUDE.md"]).toBeDefined();
      expect(cc.files["CLAUDE.md"]).toContain("CLAUDE.md");
    });

    it("includes .claude/rules/git-workflow.md", () => {
      expect(cc.files[".claude/rules/git-workflow.md"]).toBeDefined();
    });

    it("includes .claude/settings.json", () => {
      expect(cc.files[".claude/settings.json"]).toBeDefined();
      expect(cc.files[".claude/settings.json"]).toContain("permissions");
    });
  });

  describe("merge contributions", () => {
    it("adds .claude/settings.local.json to .gitignore", () => {
      expect(cc.merge[".gitignore"]).toContain("settings.local.json");
    });

    it("adds Claude credential mount to devcontainer", () => {
      const dc = cc.merge[".devcontainer/devcontainer.json"] as Record<string, unknown>;
      const mounts = dc.mounts as string[];
      expect(mounts.some((m) => m.includes(".claude"))).toBe(true);
    });
  });

  it("registers shared MCP servers", () => {
    expect(cc.mcpServers?.context7).toBeDefined();
    expect(cc.mcpServers?.fetch).toBeDefined();
  });

  describe("integration with generator", () => {
    it("generates CLAUDE.md and .claude files", () => {
      const registry = makeRegistry(createBasePreset(), cdkStub, cc);
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("CLAUDE.md")).toBe(true);
      expect(result.hasFile(".claude/rules/git-workflow.md")).toBe(true);
      expect(result.hasFile(".claude/settings.json")).toBe(true);
    });

    it("distributes MCP servers to .mcp.json", () => {
      const registry = makeRegistry(createBasePreset(), cdkStub, cc);
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile(".mcp.json")).toBe(true);
      const config = result.readJson<{ mcpServers: Record<string, unknown> }>(".mcp.json");
      expect(config.mcpServers.context7).toBeDefined();
      expect(config.mcpServers.fetch).toBeDefined();
      expect(config.mcpServers["aws-documentation"]).toBeDefined();
    });
  });
});
