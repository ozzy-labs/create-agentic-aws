import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator/index.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createKinesisPreset } from "../../src/presets/kinesis.js";
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
    dataPipeline: ["kinesis"],
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

describe("kinesis preset", () => {
  const kinesis = createKinesisPreset();

  it("has name 'kinesis'", () => {
    expect(kinesis.name).toBe("kinesis");
  });

  it("has consumer template", () => {
    expect(kinesis.files["lib/kinesis/consumer.ts"]).toBeDefined();
    expect(kinesis.files["lib/kinesis/consumer.ts"]).toContain("KinesisStreamEvent");
  });

  // -------------------------------------------------------------------------
  // IaC contributions (CDK)
  // -------------------------------------------------------------------------

  describe("iac contributions (cdk)", () => {
    const cdkContrib = kinesis.iacContributions?.cdk;

    it("provides kinesis construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/kinesis.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/kinesis.ts"]).toContain("class KinesisStream");
    });

    it("construct uses on-demand mode", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/kinesis.ts"];
      expect(construct).toContain("ON_DEMAND");
    });

    it("construct enables encryption", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/kinesis.ts"];
      expect(construct).toContain("StreamEncryption.MANAGED");
    });

    it("merges kinesis instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("KinesisStream");
      expect(merge.constructs).toContain("KinesisStream");
    });
  });

  // -------------------------------------------------------------------------
  // IaC contributions (Terraform)
  // -------------------------------------------------------------------------

  describe("iac contributions (terraform)", () => {
    const tfContrib = kinesis.iacContributions?.terraform;

    it("provides kinesis.tf file", () => {
      const tf = tfContrib?.files["infra/kinesis.tf"];
      expect(tf).toBeDefined();
      expect(tf).toContain("aws_kinesis_stream");
    });

    it("kinesis.tf uses on-demand mode", () => {
      const tf = tfContrib?.files["infra/kinesis.tf"];
      expect(tf).toContain("ON_DEMAND");
    });

    it("kinesis.tf enables encryption", () => {
      const tf = tfContrib?.files["infra/kinesis.tf"];
      expect(tf).toContain("encryption_type");
      expect(tf).toContain("KMS");
    });

    it("merges kinesis outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("kinesis_stream_name");
      expect(outputs).toContain("kinesis_stream_arn");
    });
  });

  // -------------------------------------------------------------------------
  // Integration — CDK
  // -------------------------------------------------------------------------

  describe("integration with generator (cdk)", () => {
    const allPresets = [createBasePreset(), createTypescriptPreset(), createCdkPreset(), kinesis];
    const registry = makeRegistry(...allPresets);

    it("generates kinesis construct and consumer files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/kinesis.ts")).toBe(true);
      expect(result.hasFile("lib/kinesis/consumer.ts")).toBe(true);
    });

    it("injects kinesis import into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("KinesisStream");
    });
  });

  // -------------------------------------------------------------------------
  // Integration — Terraform
  // -------------------------------------------------------------------------

  describe("integration with generator (terraform)", () => {
    const allPresets = [createBasePreset(), createTerraformPreset(), kinesis];
    const registry = makeRegistry(...allPresets);

    it("generates kinesis.tf and consumer", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/kinesis.tf")).toBe(true);
      expect(result.hasFile("lib/kinesis/consumer.ts")).toBe(true);
    });

    it("merges kinesis outputs into outputs.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("kinesis_stream_name");
    });
  });
});
