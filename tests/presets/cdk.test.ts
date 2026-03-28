import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
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

function makeRegistry(...presets: Preset[]): Map<PresetName, Preset> {
  return new Map(presets.map((p) => [p.name, p]));
}

describe("cdk preset", () => {
  const cdk = createCdkPreset();

  it("has name 'cdk'", () => {
    expect(cdk.name).toBe("cdk");
  });

  it("requires typescript", () => {
    expect(cdk.requires).toContain("typescript");
  });

  // Owned files
  describe("owned files", () => {
    const ownedFiles = [
      "infra/bin/app.ts",
      "infra/lib/app-stack.ts",
      "infra/test/app-stack.test.ts",
      "infra/cdk.json",
      "infra/tsconfig.json",
      "infra/package.json",
      ".cfnlintrc.yaml",
    ];

    for (const file of ownedFiles) {
      it(`includes ${file}`, () => {
        expect(cdk.files[file]).toBeDefined();
        expect(cdk.files[file].length).toBeGreaterThan(0);
      });
    }
  });

  // Merge contributions
  describe("merge contributions", () => {
    it("adds cdk.out to .gitignore", () => {
      const gitignore = cdk.merge[".gitignore"] as string;
      expect(gitignore).toContain("infra/cdk.out/");
    });

    it("adds aws-cdk and cfn-lint to mise tools", () => {
      const mise = cdk.merge[".mise.toml"] as Record<string, unknown>;
      const tools = mise.tools as Record<string, string>;
      expect(tools["npm:aws-cdk"]).toBeDefined();
      expect(tools["pipx:cfn-lint"]).toBeDefined();
    });

    it("adds cdk-synth to lefthook pre-push", () => {
      const lefthook = cdk.merge["lefthook.yaml"] as Record<string, unknown>;
      const prePush = lefthook["pre-push"] as Record<string, unknown>;
      const commands = prePush.commands as Record<string, unknown>;
      expect(commands["cdk-synth"]).toBeDefined();
    });

    it("adds CDK steps to CI workflow", () => {
      const ci = cdk.merge[".github/workflows/ci.yaml"] as Record<string, unknown>;
      const jobs = ci.jobs as Record<string, unknown>;
      const ciJob = jobs.ci as Record<string, unknown>;
      const steps = ciJob.steps as Array<{ name: string; run: string }>;
      expect(steps.some((s) => s.name === "CDK synth")).toBe(true);
      expect(steps.some((s) => s.name === "Lint (cfn-lint)")).toBe(true);
    });

    it("adds AWS Toolkit to VSCode extensions", () => {
      const ext = cdk.merge[".vscode/extensions.json"] as Record<string, unknown>;
      expect(ext.recommendations).toContain("amazonwebservices.aws-toolkit-vscode");
    });

    it("adds AWS Toolkit to devcontainer", () => {
      const dc = cdk.merge[".devcontainer/devcontainer.json"] as Record<string, unknown>;
      const customizations = dc.customizations as Record<string, unknown>;
      const vscode = customizations.vscode as Record<string, unknown>;
      expect(vscode.extensions).toContain("amazonwebservices.aws-toolkit-vscode");
    });
  });

  // Integration
  describe("integration with generator", () => {
    it("auto-resolves typescript dependency", () => {
      const registry = makeRegistry(createBasePreset(), createTypescriptPreset(), cdk);
      const result = generate(makeAnswers(), registry);
      // TypeScript files should be present even though languages is empty
      expect(result.hasFile("biome.json")).toBe(true);
      expect(result.hasFile("tsconfig.json")).toBe(true);
    });

    it("generates infra directory structure", () => {
      const registry = makeRegistry(createBasePreset(), createTypescriptPreset(), cdk);
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/bin/app.ts")).toBe(true);
      expect(result.hasFile("infra/lib/app-stack.ts")).toBe(true);
      expect(result.hasFile("infra/test/app-stack.test.ts")).toBe(true);
      expect(result.hasFile("infra/cdk.json")).toBe(true);
      expect(result.hasFile("infra/tsconfig.json")).toBe(true);
      expect(result.hasFile("infra/package.json")).toBe(true);
      expect(result.hasFile(".cfnlintrc.yaml")).toBe(true);
    });

    it("substitutes projectName in infra/package.json", () => {
      const registry = makeRegistry(createBasePreset(), createTypescriptPreset(), cdk);
      const result = generate(makeAnswers({ projectName: "test-app" }), registry);
      const pkg = result.readJson<{ name: string }>("infra/package.json");
      expect(pkg.name).toBe("test-app-infra");
    });

    it("merges AWS Toolkit into VSCode extensions", () => {
      const registry = makeRegistry(createBasePreset(), createTypescriptPreset(), cdk);
      const result = generate(makeAnswers(), registry);
      const ext = result.readJson<{ recommendations: string[] }>(".vscode/extensions.json");
      expect(ext.recommendations).toContain("amazonwebservices.aws-toolkit-vscode");
      // Also includes base and typescript extensions
      expect(ext.recommendations).toContain("EditorConfig.EditorConfig");
      expect(ext.recommendations).toContain("biomejs.biome");
    });

    it("merges cdk.out into .gitignore", () => {
      const registry = makeRegistry(createBasePreset(), createTypescriptPreset(), cdk);
      const result = generate(makeAnswers(), registry);
      const gitignore = result.readText(".gitignore");
      expect(gitignore).toContain("infra/cdk.out/");
    });

    it("includes cdk-nag in infra/bin/app.ts", () => {
      const registry = makeRegistry(createBasePreset(), createTypescriptPreset(), cdk);
      const result = generate(makeAnswers(), registry);
      const appTs = result.readText("infra/bin/app.ts");
      expect(appTs).toContain("AwsSolutionsChecks");
      expect(appTs).toContain("cdk-nag");
    });

    it("includes cdk-nag in infra/package.json dependencies", () => {
      const registry = makeRegistry(createBasePreset(), createTypescriptPreset(), cdk);
      const result = generate(makeAnswers(), registry);
      const pkg = result.readJson<{ dependencies: Record<string, string> }>("infra/package.json");
      expect(pkg.dependencies["cdk-nag"]).toBeDefined();
    });
  });
});
