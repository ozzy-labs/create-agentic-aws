import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator/index.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createSqsPreset } from "../../src/presets/sqs.js";
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
    integration: ["sqs"],
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

describe("sqs preset", () => {
  const sqs = createSqsPreset();

  it("has name 'sqs'", () => {
    expect(sqs.name).toBe("sqs");
  });

  // Owned files (consumer boilerplate)
  describe("owned files", () => {
    it("includes SQS consumer handler", () => {
      expect(sqs.files["lib/sqs/consumer.ts"]).toBeDefined();
      expect(sqs.files["lib/sqs/consumer.ts"]).toContain("SQSEvent");
    });

    it("consumer supports partial batch failures", () => {
      expect(sqs.files["lib/sqs/consumer.ts"]).toContain("batchItemFailures");
    });
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = sqs.iacContributions?.cdk;

    it("provides sqs construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/sqs.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/sqs.ts"]).toContain("class SqsQueue");
    });

    it("construct includes dead-letter queue", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/sqs.ts"];
      expect(construct).toContain("deadLetterQueue");
      expect(construct).toContain("DLQ");
    });

    it("construct enables encryption", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/sqs.ts"];
      expect(construct).toContain("SQS_MANAGED");
    });

    it("merges sqs instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("SqsQueue");
      expect(merge.constructs).toContain("new SqsQueue");
    });
  });

  // Merge contributions
  describe("merge contributions", () => {
    it("adds @types/aws-lambda to root devDependencies", () => {
      const pkg = sqs.merge["package.json"] as Record<string, unknown>;
      const devDeps = pkg.devDependencies as Record<string, string>;
      expect(devDeps["@types/aws-lambda"]).toBeDefined();
    });
  });

  // Integration with generator
  describe("integration with generator", () => {
    const allPresets = [createBasePreset(), createTypescriptPreset(), createCdkPreset(), sqs];
    const registry = makeRegistry(...allPresets);

    it("generates consumer file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("lib/sqs/consumer.ts")).toBe(true);
    });

    it("generates sqs construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/sqs.ts")).toBe(true);
    });

    it("injects sqs import into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('import { SqsQueue } from "./constructs/sqs"');
    });

    it("injects sqs construct into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("new SqsQueue");
    });

    it("construct outputs queue URL and DLQ URL", () => {
      const result = generate(makeAnswers(), registry);
      const construct = result.readText("infra/lib/constructs/sqs.ts");
      expect(construct).toContain("QueueUrl");
      expect(construct).toContain("DlqUrl");
    });
  });
});
