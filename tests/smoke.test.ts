import { describe, expect, it } from "vitest";

import {
  expectAllJsonValid,
  expectNoLeftoverPlaceholders,
  expectPresetsIncluded,
  generateProject,
} from "./helpers.js";

// ---------------------------------------------------------------------------
// Smoke test patterns for M2 scope
// Base + Agent + Language combinations
// (IaC service presets will be added in M3+)
// ---------------------------------------------------------------------------

describe("smoke tests", () => {
  describe("Pattern 1: Base only (CDK)", () => {
    const result = generateProject({ iac: "cdk" });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("includes base preset files", () => {
      expectPresetsIncluded(result, ["base"]);
    });

    it("generates package.json with project name", () => {
      const pkg = result.readJson<{ name: string }>("package.json");
      expect(pkg.name).toBe("test-project");
    });

    it("generates core config files", () => {
      expect(result.hasFile(".gitignore")).toBe(true);
      expect(result.hasFile(".editorconfig")).toBe(true);
      expect(result.hasFile("lefthook.yaml")).toBe(true);
      expect(result.hasFile(".devcontainer/devcontainer.json")).toBe(true);
      expect(result.hasFile(".github/workflows/ci.yaml")).toBe(true);
    });
  });

  describe("Pattern 2: Base + all agents (CDK)", () => {
    const result = generateProject({
      iac: "cdk",
      agents: ["amazon-q", "claude-code", "copilot"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("includes all agent instruction files", () => {
      expect(result.hasFile(".amazonq/rules/project.md")).toBe(true);
      expect(result.hasFile("CLAUDE.md")).toBe(true);
      expect(result.hasFile(".github/copilot-instructions.md")).toBe(true);
    });

    it("includes Claude Code specific files", () => {
      expect(result.hasFile(".claude/rules/git-workflow.md")).toBe(true);
      expect(result.hasFile(".claude/settings.json")).toBe(true);
    });

    it("distributes MCP servers to all agent configs", () => {
      expect(result.hasFile(".amazonq/mcp.json")).toBe(true);
      expect(result.hasFile(".mcp.json")).toBe(true);
      expect(result.hasFile(".github/copilot-mcp.json")).toBe(true);

      const claudeMcp = result.readJson<{ mcpServers: Record<string, unknown> }>(".mcp.json");
      expect(claudeMcp.mcpServers.context7).toBeDefined();
      expect(claudeMcp.mcpServers.fetch).toBeDefined();
      expect(claudeMcp.mcpServers["aws-documentation"]).toBeDefined();
    });
  });

  describe("Pattern 3: Base + TypeScript (CDK)", () => {
    const result = generateProject({
      iac: "cdk",
      languages: ["typescript"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("includes TypeScript files", () => {
      expect(result.hasFile("biome.json")).toBe(true);
      expect(result.hasFile("tsconfig.json")).toBe(true);
    });

    it("merges TypeScript devDeps into package.json", () => {
      const pkg = result.readJson<{ devDependencies: Record<string, string> }>("package.json");
      expect(pkg.devDependencies.typescript).toBeDefined();
      expect(pkg.devDependencies["@biomejs/biome"]).toBeDefined();
    });

    it("merges VSCode extensions", () => {
      const ext = result.readJson<{ recommendations: string[] }>(".vscode/extensions.json");
      expect(ext.recommendations).toContain("biomejs.biome");
      // Also includes base extensions
      expect(ext.recommendations).toContain("EditorConfig.EditorConfig");
    });
  });

  describe("Pattern 4: Base + Python (Terraform)", () => {
    const result = generateProject({
      iac: "terraform",
      languages: ["python"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("includes Python files", () => {
      expect(result.hasFile("pyproject.toml")).toBe(true);
    });

    it("merges Python extensions into VSCode", () => {
      const ext = result.readJson<{ recommendations: string[] }>(".vscode/extensions.json");
      expect(ext.recommendations).toContain("charliermarsh.ruff");
      expect(ext.recommendations).toContain("ms-python.python");
    });
  });

  describe("Pattern 5: Base + TypeScript + Python (CDK)", () => {
    const result = generateProject({
      iac: "cdk",
      languages: ["typescript", "python"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("includes both language files", () => {
      expect(result.hasFile("biome.json")).toBe(true);
      expect(result.hasFile("tsconfig.json")).toBe(true);
      expect(result.hasFile("pyproject.toml")).toBe(true);
    });

    it("merges both language devDeps", () => {
      const pkg = result.readJson<{ devDependencies: Record<string, string> }>("package.json");
      expect(pkg.devDependencies.typescript).toBeDefined();
    });

    it("merges both language extensions", () => {
      const ext = result.readJson<{ recommendations: string[] }>(".vscode/extensions.json");
      expect(ext.recommendations).toContain("biomejs.biome");
      expect(ext.recommendations).toContain("charliermarsh.ruff");
    });
  });

  describe("Pattern 6: Full M2 (all agents + all languages, CDK)", () => {
    const result = generateProject({
      iac: "cdk",
      agents: ["amazon-q", "claude-code", "copilot"],
      languages: ["typescript", "python"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("has significant file count", () => {
      // Should have many files from all presets
      expect(result.files.size).toBeGreaterThan(20);
    });

    it("all agent configs receive all MCP servers", () => {
      for (const configPath of [".mcp.json", ".amazonq/mcp.json", ".github/copilot-mcp.json"]) {
        const config = result.readJson<{ mcpServers: Record<string, unknown> }>(configPath);
        expect(config.mcpServers.context7, `Missing context7 in ${configPath}`).toBeDefined();
        expect(config.mcpServers.fetch, `Missing fetch in ${configPath}`).toBeDefined();
        expect(
          config.mcpServers["aws-documentation"],
          `Missing aws-documentation in ${configPath}`,
        ).toBeDefined();
      }
    });

    it("README receives markdown injections from multiple presets", () => {
      const readme = result.readText("README.md");
      expect(readme).toContain("AWS CLI");
      expect(readme).toContain("TypeScript");
      expect(readme).toContain("Python");
    });
  });
});
