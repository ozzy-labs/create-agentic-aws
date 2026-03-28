import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator.js";
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
    compute: ["ecs"],
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

// Stub for ECS (not yet implemented, but needed to trigger VPC auto-resolution)
const ecsStub: Preset = { name: "ecs", files: {}, merge: {} };

describe("vpc preset", () => {
  const vpc = createVpcPreset();

  it("has name 'vpc'", () => {
    expect(vpc.name).toBe("vpc");
  });

  it("has no owned template files", () => {
    expect(Object.keys(vpc.files)).toHaveLength(0);
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = vpc.iacContributions?.cdk;

    it("provides vpc construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/vpc.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/vpc.ts"]).toContain("class Vpc");
    });

    it("construct has public, private, and isolated subnets", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/vpc.ts"];
      expect(construct).toContain("PUBLIC");
      expect(construct).toContain("PRIVATE_WITH_EGRESS");
      expect(construct).toContain("PRIVATE_ISOLATED");
    });

    it("construct uses 2 AZs with NAT gateway", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/vpc.ts"];
      expect(construct).toContain("maxAzs: 2");
      expect(construct).toContain("natGateways: 1");
    });

    it("merges vpc instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("Vpc");
      expect(merge.constructs).toContain("new Vpc");
    });
  });

  // IaC contributions (Terraform)
  describe("iac contributions (terraform)", () => {
    const tfContrib = vpc.iacContributions?.terraform;

    it("provides vpc.tf file", () => {
      expect(tfContrib?.files["infra/vpc.tf"]).toBeDefined();
      expect(tfContrib?.files["infra/vpc.tf"]).toContain("aws_vpc");
    });

    it("vpc.tf includes subnets, IGW, NAT, route tables", () => {
      const tf = tfContrib?.files["infra/vpc.tf"];
      expect(tf).toContain("aws_subnet");
      expect(tf).toContain("aws_internet_gateway");
      expect(tf).toContain("aws_nat_gateway");
      expect(tf).toContain("aws_route_table");
    });

    it("merges vpc_cidr variable", () => {
      const vars = tfContrib?.merge?.["infra/variables.tf"] as string;
      expect(vars).toContain("vpc_cidr");
    });

    it("merges vpc outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("vpc_id");
      expect(outputs).toContain("public_subnet_ids");
      expect(outputs).toContain("private_subnet_ids");
    });
  });

  // Auto-resolution
  describe("auto-resolution", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      ecsStub,
      vpc,
    ];
    const registry = makeRegistry(...allPresets);

    it("auto-resolves vpc when ecs is selected", () => {
      const answers = makeAnswers({ compute: ["ecs"] });
      const presets = resolvePresets(answers, registry);
      const names = presets.map((p) => p.name);
      expect(names).toContain("vpc");
    });

    it("does not include vpc when no VPC-trigger service is selected", () => {
      const answers = makeAnswers({ compute: [] });
      const presets = resolvePresets(answers, registry);
      const names = presets.map((p) => p.name);
      expect(names).not.toContain("vpc");
    });
  });

  // Integration (CDK)
  describe("integration with generator (cdk)", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      ecsStub,
      vpc,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates vpc construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/vpc.ts")).toBe(true);
    });

    it("injects vpc into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("Vpc");
    });
  });

  // Integration (Terraform)
  describe("integration with generator (terraform)", () => {
    const allPresets = [createBasePreset(), createTerraformPreset(), ecsStub, vpc];
    const registry = makeRegistry(...allPresets);

    it("generates vpc.tf file", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/vpc.tf")).toBe(true);
    });

    it("merges vpc outputs into outputs.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("vpc_id");
    });
  });
});
