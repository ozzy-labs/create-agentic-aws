import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: [],
    ai: [],
    data: [],
    integration: [],
    networking: [],
    security: [],
    observability: [],
    languages: ["typescript"],
    ...overrides,
  };
}

const cdkStub: Preset = { name: "cdk", files: {}, merge: {} };

function makeRegistry(...presets: Preset[]): Map<PresetName, Preset> {
  return new Map(presets.map((p) => [p.name, p]));
}

describe("typescript preset", () => {
  const ts = createTypescriptPreset();

  it("has name 'typescript'", () => {
    expect(ts.name).toBe("typescript");
  });

  // Owned files
  describe("owned files", () => {
    it("includes biome.json", () => {
      expect(ts.files["biome.json"]).toBeDefined();
    });

    it("includes tsconfig.json", () => {
      expect(ts.files["tsconfig.json"]).toBeDefined();
    });
  });

  // Merge contributions
  describe("merge contributions", () => {
    it("adds TypeScript devDependencies to package.json", () => {
      const pkg = ts.merge["package.json"] as Record<string, unknown>;
      const devDeps = pkg.devDependencies as Record<string, string>;
      expect(devDeps.typescript).toBeDefined();
      expect(devDeps["@biomejs/biome"]).toBeDefined();
      expect(devDeps["@types/node"]).toBeDefined();
    });

    it("adds biome to lefthook pre-commit", () => {
      const lefthook = ts.merge["lefthook.yaml"] as Record<string, unknown>;
      const preCommit = lefthook["pre-commit"] as Record<string, unknown>;
      const commands = preCommit.commands as Record<string, unknown>;
      expect(commands.biome).toBeDefined();
    });

    it("adds typecheck to lefthook pre-push", () => {
      const lefthook = ts.merge["lefthook.yaml"] as Record<string, unknown>;
      const prePush = lefthook["pre-push"] as Record<string, unknown>;
      const commands = prePush.commands as Record<string, unknown>;
      expect(commands.typecheck).toBeDefined();
    });

    it("adds biome extension to VSCode", () => {
      const ext = ts.merge[".vscode/extensions.json"] as Record<string, unknown>;
      expect(ext.recommendations).toContain("biomejs.biome");
    });

    it("adds biome extension to devcontainer", () => {
      const dc = ts.merge[".devcontainer/devcontainer.json"] as Record<string, unknown>;
      const customizations = dc.customizations as Record<string, unknown>;
      const vscode = customizations.vscode as Record<string, unknown>;
      expect(vscode.extensions).toContain("biomejs.biome");
    });
  });

  // Integration
  describe("integration with generator", () => {
    it("generates biome.json and tsconfig.json", () => {
      const registry = makeRegistry(createBasePreset(), cdkStub, ts);
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("biome.json")).toBe(true);
      expect(result.hasFile("tsconfig.json")).toBe(true);
    });

    it("merges TypeScript devDeps into package.json", () => {
      const registry = makeRegistry(createBasePreset(), cdkStub, ts);
      const result = generate(makeAnswers(), registry);
      const pkg = result.readJson<Record<string, unknown>>("package.json");
      const devDeps = pkg.devDependencies as Record<string, string>;
      expect(devDeps.typescript).toBeDefined();
    });

    it("merges biome extension into .vscode/extensions.json", () => {
      const registry = makeRegistry(createBasePreset(), cdkStub, ts);
      const result = generate(makeAnswers(), registry);
      const ext = result.readJson<{ recommendations: string[] }>(".vscode/extensions.json");
      expect(ext.recommendations).toContain("biomejs.biome");
    });
  });
});
