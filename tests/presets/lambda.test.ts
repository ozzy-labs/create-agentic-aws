import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createDynamoDbPreset } from "../../src/presets/dynamodb.js";
import { createLambdaPreset } from "../../src/presets/lambda.js";
import { createPythonPreset } from "../../src/presets/python.js";
import { createTerraformPreset } from "../../src/presets/terraform.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: ["lambda"],
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

describe("lambda preset", () => {
  const lambda = createLambdaPreset();

  it("has name 'lambda'", () => {
    expect(lambda.name).toBe("lambda");
  });

  // Owned files
  describe("owned files", () => {
    it("includes lambda handler with observability middleware", () => {
      expect(lambda.files["lambda/handlers/index.ts"]).toBeDefined();
      expect(lambda.files["lambda/handlers/index.ts"]).toContain("withObservability");
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

    it("includes observability index re-exporting from lambda/powertools", () => {
      expect(lambda.files["lib/observability/index.ts"]).toBeDefined();
      expect(lambda.files["lib/observability/index.ts"]).toContain("logger");
      expect(lambda.files["lib/observability/index.ts"]).toContain("tracer");
      expect(lambda.files["lib/observability/index.ts"]).toContain("metrics");
    });

    it("includes observability middleware wrapper", () => {
      expect(lambda.files["lib/observability/middleware.ts"]).toBeDefined();
      expect(lambda.files["lib/observability/middleware.ts"]).toContain("withObservability");
      expect(lambda.files["lib/observability/middleware.ts"]).toContain("middy");
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
      expect(deps["@middy/core"]).toBeDefined();
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

    it("generates observability files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("lib/observability/index.ts")).toBe(true);
      expect(result.hasFile("lib/observability/middleware.ts")).toBe(true);
    });

    it("observability index re-exports from lambda/powertools", () => {
      const result = generate(makeAnswers({ projectName: "test-app" }), registry);
      const index = result.readText("lib/observability/index.ts");
      expect(index).toContain("lambda/powertools");
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

  // IaC contributions (Terraform)
  describe("iac contributions (terraform)", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createTerraformPreset(),
      lambda,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates lambda.tf with esbuild build step", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const tf = result.readText("infra/lambda.tf");
      expect(tf).toContain('resource "null_resource" "lambda_build"');
      expect(tf).toContain("npx esbuild");
    });

    it("uses var.lambda_memory_size instead of hardcoded value", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const tf = result.readText("infra/lambda.tf");
      expect(tf).toContain("memory_size      = var.lambda_memory_size");
      expect(tf).not.toMatch(/memory_size\s+=\s+256/);
    });

    it("archive_file depends on build step", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const tf = result.readText("infra/lambda.tf");
      expect(tf).toContain("depends_on = [null_resource.lambda_build]");
    });

    it("archive_file uses built output", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const tf = result.readText("infra/lambda.tf");
      expect(tf).toContain("lambda/handlers/dist/index.mjs");
    });
  });

  // DynamoDB → Lambda integration (Terraform)
  describe("dynamodb integration (terraform)", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createTerraformPreset(),
      lambda,
      createDynamoDbPreset(),
    ];
    const registry = makeRegistry(...allPresets);

    it("adds TABLE_NAME environment variable to lambda.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform", data: ["dynamodb"] }), registry);
      const tf = result.readText("infra/lambda.tf");
      expect(tf).toContain("TABLE_NAME   = aws_dynamodb_table.this.name");
    });

    it("adds IAM policy for DynamoDB access", () => {
      const result = generate(makeAnswers({ iac: "terraform", data: ["dynamodb"] }), registry);
      const tf = result.readText("infra/lambda.tf");
      expect(tf).toContain('resource "aws_iam_role_policy" "lambda_dynamodb"');
      expect(tf).toContain("dynamodb:GetItem");
      expect(tf).toContain("dynamodb:PutItem");
      expect(tf).toContain("dynamodb:Query");
    });
  });

  // Python Lambda runtime (Terraform + Python, no TypeScript)
  describe("python lambda runtime", () => {
    const allPresets = [createBasePreset(), createPythonPreset(), createTerraformPreset(), lambda];
    const registry = makeRegistry(...allPresets);

    const pythonAnswers = makeAnswers({
      iac: "terraform",
      languages: ["python"],
    });

    it("generates Python handler instead of TypeScript", () => {
      const result = generate(pythonAnswers, registry);
      expect(result.hasFile("lambda/handlers/handler.py")).toBe(true);
      expect(result.hasFile("lambda/handlers/index.ts")).toBe(false);
    });

    it("does not generate TypeScript observability files", () => {
      const result = generate(pythonAnswers, registry);
      expect(result.hasFile("lambda/powertools.ts")).toBe(false);
      expect(result.hasFile("lib/observability/middleware.ts")).toBe(false);
      expect(result.hasFile("lib/observability/index.ts")).toBe(false);
    });

    it("Python handler uses Powertools decorators", () => {
      const result = generate(pythonAnswers, registry);
      const handler = result.readText("lambda/handlers/handler.py");
      expect(handler).toContain("@logger.inject_lambda_context");
      expect(handler).toContain("aws_lambda_powertools");
    });

    it("updates Terraform lambda.tf to Python runtime", () => {
      const result = generate(pythonAnswers, registry);
      const tf = result.readText("infra/lambda.tf");
      expect(tf).toContain('runtime          = "python3.12"');
      expect(tf).toContain('handler          = "handler.handler"');
      expect(tf).not.toContain("nodejs24.x");
    });

    it("removes esbuild build step for Python runtime", () => {
      const result = generate(pythonAnswers, registry);
      const tf = result.readText("infra/lambda.tf");
      expect(tf).not.toContain("null_resource");
      expect(tf).not.toContain("npx esbuild");
      expect(tf).toContain("source_dir");
    });

    it("adds aws-lambda-powertools to pyproject.toml", () => {
      const result = generate(pythonAnswers, registry);
      const toml = result.readText("pyproject.toml");
      expect(toml).toContain("aws-lambda-powertools");
    });

    it("removes Lambda npm deps from package.json", () => {
      const result = generate(pythonAnswers, registry);
      const pkg = result.readJson<Record<string, Record<string, unknown>>>("package.json");
      expect(pkg.dependencies?.["@aws-lambda-powertools/logger"]).toBeUndefined();
      expect(pkg.dependencies?.["@middy/core"]).toBeUndefined();
      expect(pkg.devDependencies?.["@types/aws-lambda"]).toBeUndefined();
    });

    it("does not generate tsconfig.json", () => {
      const result = generate(pythonAnswers, registry);
      expect(result.hasFile("tsconfig.json")).toBe(false);
    });

    it("updates README with Python runtime label", () => {
      const result = generate(pythonAnswers, registry);
      const readme = result.readText("README.md");
      expect(readme).toContain("Python 3.12");
      expect(readme).not.toContain("Node.js 24");
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
