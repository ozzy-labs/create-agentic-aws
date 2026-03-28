import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator/index.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createSnsPreset } from "../../src/presets/sns.js";
import { createTerraformPreset } from "../../src/presets/terraform.js";
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
    integration: ["sns"],
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

describe("sns preset", () => {
  const sns = createSnsPreset();

  it("has name 'sns'", () => {
    expect(sns.name).toBe("sns");
  });

  it("has no owned template files", () => {
    expect(Object.keys(sns.files)).toHaveLength(0);
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = sns.iacContributions?.cdk;

    it("provides sns construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/sns.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/sns.ts"]).toContain("class SnsTopic");
    });

    it("construct enforces SSL", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/sns.ts"];
      expect(construct).toContain("enforceSSL: true");
    });

    it("merges sns instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("SnsTopic");
      expect(merge.constructs).toContain("new SnsTopic");
    });
  });

  // IaC contributions (Terraform)
  describe("iac contributions (terraform)", () => {
    const tfContrib = sns.iacContributions?.terraform;

    it("provides sns.tf with topic", () => {
      const tf = tfContrib?.files["infra/sns.tf"];
      expect(tf).toContain("aws_sns_topic");
    });

    it("sns.tf enforces SSL via topic policy", () => {
      const tf = tfContrib?.files["infra/sns.tf"];
      expect(tf).toContain("aws_sns_topic_policy");
      expect(tf).toContain("SecureTransport");
    });

    it("merges sns outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("sns_topic_arn");
    });
  });

  // Integration (CDK)
  describe("integration with generator (cdk)", () => {
    const registry = makeRegistry(
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      sns,
    );

    it("generates sns construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/sns.ts")).toBe(true);
    });

    it("injects sns into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("SnsTopic");
    });
  });

  // Integration (Terraform)
  describe("integration with generator (terraform)", () => {
    const registry = makeRegistry(createBasePreset(), createTerraformPreset(), sns);

    it("generates sns.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/sns.tf")).toBe(true);
    });

    it("merges sns outputs into outputs.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("sns_topic_arn");
    });
  });
});
