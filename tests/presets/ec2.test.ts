import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator/index.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createEc2Preset } from "../../src/presets/ec2.js";
import { createTerraformPreset } from "../../src/presets/terraform.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import { createVpcPreset } from "../../src/presets/vpc.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: ["ec2"],
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

describe("ec2 preset", () => {
  const ec2 = createEc2Preset();

  it("has name 'ec2'", () => {
    expect(ec2.name).toBe("ec2");
  });

  // Owned files
  describe("owned files", () => {
    it("includes userdata script", () => {
      expect(ec2.files["ec2/userdata.sh"]).toBeDefined();
      expect(ec2.files["ec2/userdata.sh"]).toContain("#!/bin/bash");
      expect(ec2.files["ec2/userdata.sh"]).toContain("nodejs");
    });
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = ec2.iacContributions?.cdk;

    it("provides ec2 construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/ec2.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/ec2.ts"]).toContain("class Ec2Instance");
    });

    it("construct uses Amazon Linux 2023", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/ec2.ts"];
      expect(construct).toContain("latestAmazonLinux2023");
    });

    it("construct uses SSM managed policy", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/ec2.ts"];
      expect(construct).toContain("AmazonSSMManagedInstanceCore");
    });

    it("construct requires VPC prop", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/ec2.ts"];
      expect(construct).toContain("vpc: ec2.IVpc");
    });

    it("merges ec2 instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("Ec2Instance");
      expect(merge.constructs).toContain("Ec2Instance");
    });
  });

  // IaC contributions (Terraform)
  describe("iac contributions (terraform)", () => {
    const tfContrib = ec2.iacContributions?.terraform;

    it("provides ec2.tf with instance and security group", () => {
      const tf = tfContrib?.files["infra/ec2.tf"];
      expect(tf).toContain("aws_instance");
      expect(tf).toContain("aws_security_group");
    });

    it("ec2.tf uses Amazon Linux AMI lookup", () => {
      const tf = tfContrib?.files["infra/ec2.tf"];
      expect(tf).toContain("aws_ami");
      expect(tf).toContain("al2023");
    });

    it("ec2.tf includes IAM instance profile", () => {
      const tf = tfContrib?.files["infra/ec2.tf"];
      expect(tf).toContain("aws_iam_instance_profile");
    });

    it("merges ec2 outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("ec2_instance_id");
    });
  });

  // VPC auto-resolution
  describe("vpc auto-resolution", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createVpcPreset(),
      ec2,
    ];
    const registry = makeRegistry(...allPresets);

    it("auto-resolves vpc when ec2 is selected", () => {
      const presets = resolvePresets(makeAnswers(), registry);
      const names = presets.map((p) => p.name);
      expect(names).toContain("vpc");
    });
  });

  // Integration (CDK)
  describe("integration with generator (cdk)", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createVpcPreset(),
      ec2,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates userdata script", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("ec2/userdata.sh")).toBe(true);
    });

    it("generates ec2 and vpc construct files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/ec2.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/vpc.ts")).toBe(true);
    });
  });

  // Integration (Terraform)
  describe("integration with generator (terraform)", () => {
    const allPresets = [createBasePreset(), createTerraformPreset(), createVpcPreset(), ec2];
    const registry = makeRegistry(...allPresets);

    it("generates ec2.tf and vpc.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/ec2.tf")).toBe(true);
      expect(result.hasFile("infra/vpc.tf")).toBe(true);
    });

    it("merges ec2 outputs into outputs.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("ec2_instance_id");
    });
  });
});
