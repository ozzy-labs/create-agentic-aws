import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator/index.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createRdsPreset } from "../../src/presets/rds.js";
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
    data: ["rds"],
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

describe("rds preset", () => {
  const rds = createRdsPreset();

  it("has name 'rds'", () => {
    expect(rds.name).toBe("rds");
  });

  it("has no owned template files", () => {
    expect(Object.keys(rds.files)).toHaveLength(0);
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = rds.iacContributions?.cdk;

    it("provides rds construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/rds.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/rds.ts"]).toContain("class RdsInstance");
    });

    it("construct uses PostgreSQL engine", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/rds.ts"];
      expect(construct).toContain("postgres");
    });

    it("construct uses Secrets Manager for credentials", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/rds.ts"];
      expect(construct).toContain("fromGeneratedSecret");
    });

    it("construct enables storage encryption and backup", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/rds.ts"];
      expect(construct).toContain("storageEncrypted: true");
      expect(construct).toContain("backupRetention");
    });

    it("construct requires VPC prop", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/rds.ts"];
      expect(construct).toContain("vpc: ec2.IVpc");
    });

    it("merges rds instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("RdsInstance");
      expect(merge.constructs).toContain("RdsInstance");
    });
  });

  // IaC contributions (Terraform)
  describe("iac contributions (terraform)", () => {
    const tfContrib = rds.iacContributions?.terraform;

    it("provides rds.tf with instance", () => {
      const tf = tfContrib?.files["infra/rds.tf"];
      expect(tf).toContain("aws_db_instance");
    });

    it("rds.tf uses managed master password (Secrets Manager)", () => {
      const tf = tfContrib?.files["infra/rds.tf"];
      expect(tf).toContain("manage_master_user_password");
    });

    it("rds.tf includes security group and subnet group", () => {
      const tf = tfContrib?.files["infra/rds.tf"];
      expect(tf).toContain("aws_security_group");
      expect(tf).toContain("aws_db_subnet_group");
    });

    it("merges rds outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("rds_instance_endpoint");
      expect(outputs).toContain("rds_master_secret_arn");
    });
  });

  // VPC auto-resolution
  describe("vpc auto-resolution", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createVpcPreset(),
      rds,
    ];
    const registry = makeRegistry(...allPresets);

    it("auto-resolves vpc when rds is selected", () => {
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
      rds,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates rds and vpc construct files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/rds.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/vpc.ts")).toBe(true);
    });

    it("defaults to PostgreSQL engine in CDK construct", () => {
      const result = generate(makeAnswers(), registry);
      const construct = result.readText("infra/lib/constructs/rds.ts");
      expect(construct).toContain("DatabaseInstanceEngine.postgres");
      expect(construct).toContain("PostgresEngineVersion.VER_16_4");
    });

    it("uses MySQL engine in CDK construct when rdsOptions.engine is mysql", () => {
      const result = generate(makeAnswers({ rdsOptions: { engine: "mysql" } }), registry);
      const construct = result.readText("infra/lib/constructs/rds.ts");
      expect(construct).toContain("DatabaseInstanceEngine.mysql");
      expect(construct).toContain("MysqlEngineVersion.VER_8_0_40");
      expect(construct).not.toContain("DatabaseInstanceEngine.postgres");
    });
  });

  // Integration (Terraform)
  describe("integration with generator (terraform)", () => {
    const allPresets = [createBasePreset(), createTerraformPreset(), createVpcPreset(), rds];
    const registry = makeRegistry(...allPresets);

    it("generates rds.tf and vpc.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/rds.tf")).toBe(true);
      expect(result.hasFile("infra/vpc.tf")).toBe(true);
    });

    it("merges rds outputs into outputs.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("rds_instance_endpoint");
    });

    it("defaults to PostgreSQL engine in Terraform", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const tf = result.readText("infra/rds.tf");
      expect(tf).toContain('engine         = "postgres"');
      expect(tf).toContain("from_port   = 5432");
    });

    it("uses MySQL engine in Terraform when rdsOptions.engine is mysql", () => {
      const result = generate(
        makeAnswers({ iac: "terraform", rdsOptions: { engine: "mysql" } }),
        registry,
      );
      const tf = result.readText("infra/rds.tf");
      expect(tf).toContain('engine         = "mysql"');
      expect(tf).toContain('engine_version = "8.0.40"');
      expect(tf).toContain("from_port   = 3306");
      expect(tf).toContain("to_port     = 3306");
      expect(tf).not.toContain('"postgres"');
      expect(tf).not.toContain("5432");
    });
  });

  // README engine label
  describe("readme engine label", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createVpcPreset(),
      rds,
    ];
    const registry = makeRegistry(...allPresets);

    it("defaults to PostgreSQL in README", () => {
      const result = generate(makeAnswers(), registry);
      const readme = result.readText("README.md");
      expect(readme).toContain("PostgreSQL relational database");
    });

    it("uses MySQL in README when rdsOptions.engine is mysql", () => {
      const result = generate(makeAnswers({ rdsOptions: { engine: "mysql" } }), registry);
      const readme = result.readText("README.md");
      expect(readme).toContain("MySQL relational database");
      expect(readme).not.toContain("PostgreSQL relational database");
    });
  });
});
