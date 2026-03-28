import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createPythonPreset } from "../../src/presets/python.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "terraform",
    compute: [],
    ai: [],
    data: [],
    integration: [],
    networking: [],
    security: [],
    observability: [],
    languages: ["python"],
    ...overrides,
  };
}

const terraformStub: Preset = { name: "terraform", files: {}, merge: {} };

function makeRegistry(...presets: Preset[]): Map<PresetName, Preset> {
  return new Map(presets.map((p) => [p.name, p]));
}

describe("python preset", () => {
  const py = createPythonPreset();

  it("has name 'python'", () => {
    expect(py.name).toBe("python");
  });

  // Owned files
  describe("owned files", () => {
    it("includes pyproject.toml", () => {
      expect(py.files["pyproject.toml"]).toBeDefined();
    });

    it("pyproject.toml contains {{projectName}}", () => {
      expect(py.files["pyproject.toml"]).toContain("{{projectName}}");
    });
  });

  // Merge contributions
  describe("merge contributions", () => {
    it("adds python to .mise.toml tools", () => {
      const mise = py.merge[".mise.toml"] as Record<string, unknown>;
      const tools = mise.tools as Record<string, string>;
      expect(tools.python).toBeDefined();
      expect(tools.uv).toBeDefined();
    });

    it("adds ruff and mypy to lefthook", () => {
      const lefthook = py.merge["lefthook.yaml"] as Record<string, unknown>;
      const preCommit = lefthook["pre-commit"] as Record<string, unknown>;
      const commands = preCommit.commands as Record<string, unknown>;
      expect(commands.ruff).toBeDefined();
      expect(commands.mypy).toBeDefined();
    });

    it("adds Python extensions to VSCode", () => {
      const ext = py.merge[".vscode/extensions.json"] as Record<string, unknown>;
      const recs = ext.recommendations as string[];
      expect(recs).toContain("charliermarsh.ruff");
      expect(recs).toContain("ms-python.python");
    });

    it("adds Python feature to devcontainer", () => {
      const dc = py.merge[".devcontainer/devcontainer.json"] as Record<string, unknown>;
      const features = dc.features as Record<string, unknown>;
      expect(features["ghcr.io/devcontainers/features/python:1"]).toBeDefined();
    });
  });

  // Integration
  describe("integration with generator", () => {
    it("generates pyproject.toml with project name", () => {
      const registry = makeRegistry(createBasePreset(), terraformStub, py);
      const result = generate(makeAnswers({ projectName: "test-py" }), registry);
      expect(result.hasFile("pyproject.toml")).toBe(true);
      const content = result.readText("pyproject.toml");
      expect(content).toContain("test-py");
    });

    it("merges Python extensions into .vscode/extensions.json", () => {
      const registry = makeRegistry(createBasePreset(), terraformStub, py);
      const result = generate(makeAnswers(), registry);
      const ext = result.readJson<{ recommendations: string[] }>(".vscode/extensions.json");
      expect(ext.recommendations).toContain("charliermarsh.ruff");
    });
  });
});
