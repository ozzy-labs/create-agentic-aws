import { describe, expect, it } from "vitest";
import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createBedrockPreset } from "../../src/presets/bedrock.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createTerraformPreset } from "../../src/presets/terraform.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: [],
    ai: ["bedrock"],
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

describe("bedrock preset", () => {
  const bedrock = createBedrockPreset();

  it("has name 'bedrock'", () => {
    expect(bedrock.name).toBe("bedrock");
  });

  describe("owned files", () => {
    it("includes Bedrock client", () => {
      expect(bedrock.files["lib/bedrock/client.ts"]).toBeDefined();
      expect(bedrock.files["lib/bedrock/client.ts"]).toContain("BedrockRuntimeClient");
    });

    it("includes invoke helper", () => {
      expect(bedrock.files["lib/bedrock/invoke.ts"]).toBeDefined();
      expect(bedrock.files["lib/bedrock/invoke.ts"]).toContain("invokeModel");
      expect(bedrock.files["lib/bedrock/invoke.ts"]).toContain("ConverseCommand");
    });
  });

  describe("iac contributions (cdk)", () => {
    const cdkContrib = bedrock.iacContributions?.cdk;

    it("provides bedrock construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/bedrock.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/bedrock.ts"]).toContain("class BedrockAccess");
    });

    it("construct includes InvokeModel permission", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/bedrock.ts"];
      expect(construct).toContain("bedrock:InvokeModel");
    });

    it("merges bedrock instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("BedrockAccess");
      expect(merge.constructs).toContain("new BedrockAccess");
    });
  });

  describe("iac contributions (terraform)", () => {
    const tfContrib = bedrock.iacContributions?.terraform;

    it("provides bedrock.tf file", () => {
      expect(tfContrib?.files["infra/bedrock.tf"]).toBeDefined();
      expect(tfContrib?.files["infra/bedrock.tf"]).toContain("bedrock:InvokeModel");
    });

    it("provides outputs", () => {
      const merge = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(merge).toContain("bedrock_policy_arn");
    });
  });

  describe("merge contributions", () => {
    it("adds Bedrock Runtime SDK to root dependencies", () => {
      const pkg = bedrock.merge["package.json"] as Record<string, unknown>;
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps["@aws-sdk/client-bedrock-runtime"]).toBeDefined();
    });
  });

  describe("tsconfig.json auto-resolution (terraform without typescript)", () => {
    const allPresets = [createBasePreset(), createTerraformPreset(), bedrock];
    const registry = makeRegistry(...allPresets);

    it("generates tsconfig.json with compilerOptions when TypeScript preset is absent", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("tsconfig.json")).toBe(true);
      const tsconfig = result.readJson<{ compilerOptions: object; include: string[] }>(
        "tsconfig.json",
      );
      expect(tsconfig.compilerOptions).toBeDefined();
      expect(tsconfig.compilerOptions).toHaveProperty("target");
      expect(tsconfig.compilerOptions).toHaveProperty("module");
      expect(tsconfig.include).toContain("lib");
    });
  });

  describe("integration with generator", () => {
    const allPresets = [createBasePreset(), createTypescriptPreset(), createCdkPreset(), bedrock];
    const registry = makeRegistry(...allPresets);

    it("generates SDK boilerplate files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("lib/bedrock/client.ts")).toBe(true);
      expect(result.hasFile("lib/bedrock/invoke.ts")).toBe(true);
    });

    it("generates bedrock construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/bedrock.ts")).toBe(true);
    });

    it("injects bedrock import into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('import { BedrockAccess } from "./constructs/bedrock"');
    });

    it("merges Bedrock SDK into root package.json dependencies", () => {
      const result = generate(makeAnswers(), registry);
      const pkg = result.readJson<{ dependencies: Record<string, string> }>("package.json");
      expect(pkg.dependencies["@aws-sdk/client-bedrock-runtime"]).toBeDefined();
    });
  });
});
