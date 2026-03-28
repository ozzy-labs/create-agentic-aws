import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator.js";
import { createAuroraPreset } from "../../src/presets/aurora.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createTerraformPreset } from "../../src/presets/terraform.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import { createVpcPreset } from "../../src/presets/vpc.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: [],
    ai: [],
    data: ["aurora"],
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

describe("aurora preset", () => {
  const aurora = createAuroraPreset();

  it("has name 'aurora'", () => {
    expect(aurora.name).toBe("aurora");
  });

  it("has no owned template files", () => {
    expect(Object.keys(aurora.files)).toHaveLength(0);
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = aurora.iacContributions?.cdk;

    it("provides aurora construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/aurora.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/aurora.ts"]).toContain("class AuroraCluster");
    });

    it("construct uses Aurora PostgreSQL serverless v2", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/aurora.ts"];
      expect(construct).toContain("auroraPostgres");
      expect(construct).toContain("serverlessV2");
    });

    it("construct uses Secrets Manager for credentials", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/aurora.ts"];
      expect(construct).toContain("fromGeneratedSecret");
    });

    it("construct enables storage encryption", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/aurora.ts"];
      expect(construct).toContain("storageEncrypted: true");
    });

    it("construct requires VPC prop", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/aurora.ts"];
      expect(construct).toContain("vpc: ec2.IVpc");
    });

    it("merges aurora instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("AuroraCluster");
      expect(merge.constructs).toContain("AuroraCluster");
    });
  });

  // IaC contributions (Terraform)
  describe("iac contributions (terraform)", () => {
    const tfContrib = aurora.iacContributions?.terraform;

    it("provides aurora.tf with cluster and instance", () => {
      const tf = tfContrib?.files["infra/aurora.tf"];
      expect(tf).toContain("aws_rds_cluster");
      expect(tf).toContain("aws_rds_cluster_instance");
    });

    it("aurora.tf uses serverless v2 scaling", () => {
      const tf = tfContrib?.files["infra/aurora.tf"];
      expect(tf).toContain("serverlessv2_scaling_configuration");
      expect(tf).toContain("db.serverless");
    });

    it("aurora.tf uses managed master password (Secrets Manager)", () => {
      const tf = tfContrib?.files["infra/aurora.tf"];
      expect(tf).toContain("manage_master_user_password");
    });

    it("aurora.tf includes security group and subnet group", () => {
      const tf = tfContrib?.files["infra/aurora.tf"];
      expect(tf).toContain("aws_security_group");
      expect(tf).toContain("aws_db_subnet_group");
    });

    it("merges aurora outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("aurora_cluster_endpoint");
      expect(outputs).toContain("aurora_master_secret_arn");
    });
  });

  // VPC auto-resolution
  describe("vpc auto-resolution", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createVpcPreset(),
      aurora,
    ];
    const registry = makeRegistry(...allPresets);

    it("auto-resolves vpc when aurora is selected", () => {
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
      aurora,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates aurora and vpc construct files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/aurora.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/vpc.ts")).toBe(true);
    });
  });

  // Integration (Terraform)
  describe("integration with generator (terraform)", () => {
    const allPresets = [createBasePreset(), createTerraformPreset(), createVpcPreset(), aurora];
    const registry = makeRegistry(...allPresets);

    it("generates aurora.tf and vpc.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/aurora.tf")).toBe(true);
      expect(result.hasFile("infra/vpc.tf")).toBe(true);
    });

    it("merges aurora outputs into outputs.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("aurora_cluster_endpoint");
    });
  });
});
