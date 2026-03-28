import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
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
    languages: [],
    ...overrides,
  };
}

function makeRegistry(...presets: Preset[]): Map<PresetName, Preset> {
  return new Map(presets.map((p) => [p.name, p]));
}

// Minimal CDK preset stub (base always needs an IaC preset in answers)
const cdkStub: Preset = { name: "cdk", files: {}, merge: {} };

describe("base preset", () => {
  const base = createBasePreset();

  it("has name 'base'", () => {
    expect(base.name).toBe("base");
  });

  // -----------------------------------------------------------------------
  // Owned files
  // -----------------------------------------------------------------------

  describe("owned files", () => {
    const ownedFiles = [
      ".gitignore",
      ".gitattributes",
      ".editorconfig",
      ".npmrc",
      ".commitlintrc.yaml",
      ".gitleaks.toml",
      ".markdownlint-cli2.yaml",
      ".mdformat.toml",
      ".yamllint.yaml",
      ".yamlfmt.yaml",
      ".mcp.json.example",
      "renovate.json",
      ".github/PULL_REQUEST_TEMPLATE.md",
      "docs/cd-setup.md",
      "scripts/setup.sh",
      "scripts/configure-repo.sh",
      "scripts/apply-rulesets.sh",
      "README.md",
    ];

    for (const file of ownedFiles) {
      it(`includes ${file}`, () => {
        expect(base.files[file]).toBeDefined();
        expect(base.files[file].length).toBeGreaterThan(0);
      });
    }
  });

  // -----------------------------------------------------------------------
  // Shared files (base provides initial template)
  // -----------------------------------------------------------------------

  describe("shared file templates", () => {
    const sharedFiles = [
      "package.json",
      ".mise.toml",
      "lefthook.yaml",
      ".devcontainer/devcontainer.json",
      ".github/workflows/ci.yaml",
      ".vscode/settings.json",
      ".vscode/extensions.json",
    ];

    for (const file of sharedFiles) {
      it(`provides ${file} template`, () => {
        expect(base.files[file]).toBeDefined();
        expect(base.files[file].length).toBeGreaterThan(0);
      });
    }
  });

  // -----------------------------------------------------------------------
  // package.json content
  // -----------------------------------------------------------------------

  describe("package.json template", () => {
    it("contains {{projectName}} placeholder", () => {
      expect(base.files["package.json"]).toContain("{{projectName}}");
    });

    it("includes commitlint devDependencies", () => {
      expect(base.files["package.json"]).toContain("@commitlint/cli");
    });

    it("includes lefthook devDependency", () => {
      expect(base.files["package.json"]).toContain("lefthook");
    });
  });

  // -----------------------------------------------------------------------
  // .mise.toml content
  // -----------------------------------------------------------------------

  describe(".mise.toml template", () => {
    it("includes node", () => {
      expect(base.files[".mise.toml"]).toContain("node");
    });

    it("includes pnpm", () => {
      expect(base.files[".mise.toml"]).toContain("pnpm");
    });

    it("includes awscli", () => {
      expect(base.files[".mise.toml"]).toContain("awscli");
    });
  });

  // -----------------------------------------------------------------------
  // VSCode extensions
  // -----------------------------------------------------------------------

  describe("vscode extensions template", () => {
    it("includes AWS Toolkit extension", () => {
      expect(base.files[".vscode/extensions.json"]).toContain(
        "amazonwebservices.aws-toolkit-vscode",
      );
    });
  });

  // -----------------------------------------------------------------------
  // devcontainer
  // -----------------------------------------------------------------------

  describe("devcontainer template", () => {
    it("includes AWS Toolkit extension", () => {
      expect(base.files[".devcontainer/devcontainer.json"]).toContain(
        "amazonwebservices.aws-toolkit-vscode",
      );
    });
  });

  // -----------------------------------------------------------------------
  // MCP servers
  // -----------------------------------------------------------------------

  describe("MCP servers", () => {
    it("includes aws-documentation MCP server", () => {
      expect(base.mcpServers).toBeDefined();
      expect(base.mcpServers?.["aws-documentation"]).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Integration with generator
  // -----------------------------------------------------------------------

  describe("integration with generator", () => {
    it("generates project with correct name substitution", () => {
      const registry = makeRegistry(base, cdkStub);
      const result = generate(makeAnswers({ projectName: "test-app" }), registry);

      const pkg = result.readJson<{ name: string }>("package.json");
      expect(pkg.name).toBe("test-app");
    });

    it("generates all owned files", () => {
      const registry = makeRegistry(base, cdkStub);
      const result = generate(makeAnswers(), registry);

      expect(result.hasFile(".gitignore")).toBe(true);
      expect(result.hasFile(".editorconfig")).toBe(true);
      expect(result.hasFile("package.json")).toBe(true);
      expect(result.hasFile("lefthook.yaml")).toBe(true);
      expect(result.hasFile(".devcontainer/devcontainer.json")).toBe(true);
      expect(result.hasFile(".github/workflows/ci.yaml")).toBe(true);
      expect(result.hasFile("README.md")).toBe(true);
    });

    it("substitutes projectName in devcontainer", () => {
      const registry = makeRegistry(base, cdkStub);
      const result = generate(makeAnswers({ projectName: "my-app" }), registry);

      const devcontainer = result.readText(".devcontainer/devcontainer.json");
      expect(devcontainer).toContain("my-app");
    });

    it("README contains markdown injections from base", () => {
      const registry = makeRegistry(base, cdkStub);
      const result = generate(makeAnswers(), registry);

      const readme = result.readText("README.md");
      expect(readme).toContain("AWS CLI");
    });
  });
});
