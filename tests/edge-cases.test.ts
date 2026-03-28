import { describe, expect, it } from "vitest";

import { resolvePresets } from "../src/generator.js";
import { createRegistry } from "../src/presets/registry.js";
import {
  expectAllJsonValid,
  expectNoLeftoverPlaceholders,
  generateProject,
  makeAnswers,
} from "./helpers.js";

const registry = createRegistry();

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  describe("minimal project (no agents, no languages, no services)", () => {
    const result = generateProject({
      projectName: "minimal",
      agents: [],
      iac: "cdk",
      languages: [],
    });

    it("generates valid output", () => {
      expectAllJsonValid(result);
      expectNoLeftoverPlaceholders(result);
    });

    it("still has base files", () => {
      expect(result.hasFile("package.json")).toBe(true);
      expect(result.hasFile(".gitignore")).toBe(true);
    });

    it("does not generate agent files", () => {
      expect(result.hasFile("CLAUDE.md")).toBe(false);
      expect(result.hasFile(".amazonq/rules/project.md")).toBe(false);
      expect(result.hasFile(".github/copilot-instructions.md")).toBe(false);
    });

    it("does not generate MCP configs (no agents)", () => {
      expect(result.hasFile(".mcp.json")).toBe(false);
      expect(result.hasFile(".amazonq/mcp.json")).toBe(false);
    });
  });

  describe("special characters in project name", () => {
    it("handles dots in name", () => {
      const result = generateProject({ projectName: "my.project" });
      expectNoLeftoverPlaceholders(result);
      const pkg = result.readJson<{ name: string }>("package.json");
      expect(pkg.name).toBe("my.project");
    });

    it("handles hyphens in name", () => {
      const result = generateProject({ projectName: "my-aws-app" });
      expectNoLeftoverPlaceholders(result);
      const pkg = result.readJson<{ name: string }>("package.json");
      expect(pkg.name).toBe("my-aws-app");
    });
  });

  describe("preset resolution edge cases", () => {
    it("resolves base even when no other presets selected", () => {
      const presets = resolvePresets(makeAnswers({ iac: "cdk" }), registry);
      expect(presets.some((p) => p.name === "base")).toBe(true);
    });

    it("does not duplicate presets", () => {
      const presets = resolvePresets(
        makeAnswers({ iac: "cdk", languages: ["typescript"] }),
        registry,
      );
      const names = presets.map((p) => p.name);
      const unique = [...new Set(names)];
      expect(names.length).toBe(unique.length);
    });

    it("maintains canonical order regardless of input order", () => {
      const presets = resolvePresets(
        makeAnswers({
          iac: "cdk",
          agents: ["copilot", "amazon-q", "claude-code"],
          languages: ["python", "typescript"],
        }),
        registry,
      );
      const names = presets.map((p) => p.name);
      const tsIdx = names.indexOf("typescript");
      const pyIdx = names.indexOf("python");
      const aqIdx = names.indexOf("amazon-q");
      const ccIdx = names.indexOf("claude-code");
      const cpIdx = names.indexOf("copilot");

      // base < typescript < python < amazon-q < claude-code < copilot < cdk
      expect(tsIdx).toBeLessThan(pyIdx);
      expect(pyIdx).toBeLessThan(aqIdx);
      expect(aqIdx).toBeLessThan(ccIdx);
      expect(ccIdx).toBeLessThan(cpIdx);
    });
  });

  describe("single agent selection", () => {
    it("claude-code only: generates .mcp.json.example but not .mcp.json or other agent configs", () => {
      const result = generateProject({ agents: ["claude-code"] });
      expect(result.hasFile(".mcp.json")).toBe(false);
      expect(result.hasFile(".mcp.json.example")).toBe(true);
      expect(result.hasFile(".amazonq/mcp.json")).toBe(false);
      expect(result.hasFile(".github/copilot-mcp.json")).toBe(false);
    });

    it("amazon-q only: generates .amazonq/mcp.json but not .mcp.json", () => {
      const result = generateProject({ agents: ["amazon-q"] });
      expect(result.hasFile(".amazonq/mcp.json")).toBe(true);
      expect(result.hasFile(".mcp.json")).toBe(false);
    });
  });

  describe("IaC variants", () => {
    it("CDK answers produce valid output", () => {
      const result = generateProject({ iac: "cdk" });
      expectAllJsonValid(result);
      expectNoLeftoverPlaceholders(result);
    });

    it("Terraform answers produce valid output", () => {
      const result = generateProject({ iac: "terraform" });
      expectAllJsonValid(result);
      expectNoLeftoverPlaceholders(result);
    });
  });
});
