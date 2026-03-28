import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator/index.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createEcsPreset } from "../../src/presets/ecs.js";
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

describe("ecs preset", () => {
  const ecs = createEcsPreset();

  it("has name 'ecs'", () => {
    expect(ecs.name).toBe("ecs");
  });

  // Owned files (Dockerfile + app)
  describe("owned files", () => {
    it("includes Dockerfile", () => {
      expect(ecs.files["ecs/Dockerfile"]).toBeDefined();
      expect(ecs.files["ecs/Dockerfile"]).toContain("FROM node:24-slim");
    });

    it("includes app entry point", () => {
      expect(ecs.files["ecs/src/index.ts"]).toBeDefined();
      expect(ecs.files["ecs/src/index.ts"]).toContain("createServer");
    });

    it("includes health check endpoint", () => {
      expect(ecs.files["ecs/src/index.ts"]).toContain("/health");
    });

    it("includes ecs package.json", () => {
      expect(ecs.files["ecs/package.json"]).toBeDefined();
    });

    it("includes ecs tsconfig.json", () => {
      expect(ecs.files["ecs/tsconfig.json"]).toBeDefined();
    });
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = ecs.iacContributions?.cdk;

    it("provides ecs construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/ecs.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/ecs.ts"]).toContain("class EcsService");
    });

    it("construct uses Fargate with ALB", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/ecs.ts"];
      expect(construct).toContain("ApplicationLoadBalancedFargateService");
    });

    it("construct requires VPC prop", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/ecs.ts"];
      expect(construct).toContain("vpc: ec2.IVpc");
    });

    it("construct enables container insights", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/ecs.ts"];
      expect(construct).toContain("containerInsights: true");
    });

    it("construct has circuit breaker", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/ecs.ts"];
      expect(construct).toContain("circuitBreaker");
    });

    it("merges ecs instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("EcsService");
      expect(merge.constructs).toContain("EcsService");
    });
  });

  // IaC contributions (Terraform)
  describe("iac contributions (terraform)", () => {
    const tfContrib = ecs.iacContributions?.terraform;

    it("provides ecs.tf file", () => {
      expect(tfContrib?.files["infra/ecs.tf"]).toBeDefined();
      expect(tfContrib?.files["infra/ecs.tf"]).toContain("aws_ecs_cluster");
    });

    it("ecs.tf uses Fargate launch type", () => {
      const tf = tfContrib?.files["infra/ecs.tf"];
      expect(tf).toContain("FARGATE");
    });

    it("ecs.tf includes security group", () => {
      const tf = tfContrib?.files["infra/ecs.tf"];
      expect(tf).toContain("aws_security_group");
    });

    it("uses vpc resources directly instead of variables", () => {
      const tf = tfContrib?.files["infra/ecs.tf"] as string;
      expect(tf).toContain("aws_vpc.this.id");
      expect(tf).toContain("aws_subnet.private[*].id");
      expect(tf).not.toContain("var.vpc_id");
      expect(tf).not.toContain("var.private_subnet_ids");
    });

    it("merges ecs outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("ecs_cluster_name");
      expect(outputs).toContain("ecs_service_name");
    });
  });

  // Merge contributions
  describe("merge contributions", () => {
    it("adds hadolint hook to lefthook pre-commit", () => {
      const lefthook = ecs.merge["lefthook.yaml"] as Record<string, unknown>;
      const preCommit = lefthook["pre-commit"] as Record<string, unknown>;
      const commands = preCommit.commands as Record<string, unknown>;
      expect(commands.hadolint).toBeDefined();
    });
  });

  // VPC auto-resolution
  describe("vpc auto-resolution", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createVpcPreset(),
      ecs,
    ];
    const registry = makeRegistry(...allPresets);

    it("auto-resolves vpc when ecs is selected", () => {
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
      ecs,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates ecs app files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("ecs/Dockerfile")).toBe(true);
      expect(result.hasFile("ecs/src/index.ts")).toBe(true);
      expect(result.hasFile("ecs/package.json")).toBe(true);
    });

    it("generates ecs construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/ecs.ts")).toBe(true);
    });

    it("also generates vpc construct (auto-resolved)", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/vpc.ts")).toBe(true);
    });

    it("substitutes projectName in ecs/package.json", () => {
      const result = generate(makeAnswers({ projectName: "test-app" }), registry);
      const pkg = result.readJson<{ name: string }>("ecs/package.json");
      expect(pkg.name).toBe("test-app-ecs");
    });
  });

  // Integration (Terraform)
  describe("integration with generator (terraform)", () => {
    const allPresets = [createBasePreset(), createTerraformPreset(), createVpcPreset(), ecs];
    const registry = makeRegistry(...allPresets);

    it("generates ecs.tf and vpc.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/ecs.tf")).toBe(true);
      expect(result.hasFile("infra/vpc.tf")).toBe(true);
    });

    it("merges ecs outputs into outputs.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("ecs_cluster_name");
    });
  });
});
