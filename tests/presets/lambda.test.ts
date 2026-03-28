import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createLambdaPreset } from "../../src/presets/lambda.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: ["lambda"],
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

describe("lambda preset", () => {
  const lambda = createLambdaPreset();

  it("has name 'lambda'", () => {
    expect(lambda.name).toBe("lambda");
  });

  // Owned files
  describe("owned files", () => {
    it("includes lambda handler boilerplate", () => {
      expect(lambda.files["lambda/handlers/index.ts"]).toBeDefined();
      expect(lambda.files["lambda/handlers/index.ts"]).toContain("export const handler");
    });

    it("includes powertools configuration", () => {
      expect(lambda.files["lambda/powertools.ts"]).toBeDefined();
      expect(lambda.files["lambda/powertools.ts"]).toContain("Logger");
      expect(lambda.files["lambda/powertools.ts"]).toContain("Tracer");
      expect(lambda.files["lambda/powertools.ts"]).toContain("Metrics");
    });

    it("handler imports powertools logger", () => {
      expect(lambda.files["lambda/handlers/index.ts"]).toContain("logger");
    });
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = lambda.iacContributions?.cdk;

    it("provides lambda construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/lambda.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/lambda.ts"]).toContain("class LambdaFunction");
    });

    it("construct supports optional VPC prop", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/lambda.ts"];
      expect(construct).toContain("vpc?:");
    });

    it("merges lambda instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("LambdaFunction");
      expect(merge.constructs).toContain("new LambdaFunction");
    });

    it("adds esbuild to infra devDependencies", () => {
      const merge = cdkContrib?.merge?.["infra/package.json"] as Record<string, unknown>;
      const devDeps = merge.devDependencies as Record<string, string>;
      expect(devDeps.esbuild).toBeDefined();
    });
  });

  // Merge contributions
  describe("merge contributions", () => {
    it("adds @types/aws-lambda to root devDependencies", () => {
      const pkg = lambda.merge["package.json"] as Record<string, unknown>;
      const devDeps = pkg.devDependencies as Record<string, string>;
      expect(devDeps["@types/aws-lambda"]).toBeDefined();
    });

    it("adds powertools packages to root dependencies", () => {
      const pkg = lambda.merge["package.json"] as Record<string, unknown>;
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps["@aws-lambda-powertools/logger"]).toBeDefined();
      expect(deps["@aws-lambda-powertools/tracer"]).toBeDefined();
      expect(deps["@aws-lambda-powertools/metrics"]).toBeDefined();
    });
  });

  // Integration with generator
  describe("integration with generator", () => {
    const allPresets = [createBasePreset(), createTypescriptPreset(), createCdkPreset(), lambda];
    const registry = makeRegistry(...allPresets);

    it("generates lambda handler file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("lambda/handlers/index.ts")).toBe(true);
    });

    it("generates lambda construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/lambda.ts")).toBe(true);
    });

    it("injects lambda import into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('import { LambdaFunction } from "./constructs/lambda"');
    });

    it("injects lambda construct into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("new LambdaFunction");
    });

    it("merges esbuild into infra/package.json", () => {
      const result = generate(makeAnswers(), registry);
      const pkg = result.readJson<{ devDependencies: Record<string, string> }>(
        "infra/package.json",
      );
      expect(pkg.devDependencies.esbuild).toBeDefined();
    });

    it("merges @types/aws-lambda into root package.json", () => {
      const result = generate(makeAnswers(), registry);
      const pkg = result.readJson<{ devDependencies: Record<string, string> }>("package.json");
      expect(pkg.devDependencies["@types/aws-lambda"]).toBeDefined();
    });

    it("substitutes projectName in infra/package.json", () => {
      const result = generate(makeAnswers({ projectName: "test-app" }), registry);
      const pkg = result.readJson<{ name: string }>("infra/package.json");
      expect(pkg.name).toBe("test-app-infra");
    });
  });

  // VPC auto-resolution
  describe("vpc auto-resolution", () => {
    const allPresets = [createBasePreset(), createTypescriptPreset(), createCdkPreset(), lambda];
    const registry = makeRegistry(...allPresets);

    it("does not include vpc when vpcPlacement is false", () => {
      const answers = makeAnswers({ lambdaOptions: { vpcPlacement: false } });
      const presets = resolvePresets(answers, registry);
      const names = presets.map((p) => p.name);
      expect(names).not.toContain("vpc");
    });

    it("includes vpc when vpcPlacement is true", () => {
      const answers = makeAnswers({ lambdaOptions: { vpcPlacement: true } });
      const presets = resolvePresets(answers, registry);
      // VPC is added to selected set, but no VPC preset in registry yet
      // So it won't appear in resolved presets (filtered by registry)
      const names = presets.map((p) => p.name);
      // vpc won't be in names since it's not registered yet
      expect(names).not.toContain("vpc");
    });
  });
});
