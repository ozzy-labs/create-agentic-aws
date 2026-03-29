import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator/index.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createEksPreset } from "../../src/presets/eks.js";
import { createTerraformPreset } from "../../src/presets/terraform.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import { createVpcPreset } from "../../src/presets/vpc.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: ["eks"],
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

describe("eks preset", () => {
  const eks = createEksPreset();

  it("has name 'eks'", () => {
    expect(eks.name).toBe("eks");
  });

  // Owned files
  describe("owned files", () => {
    it("includes Dockerfile", () => {
      expect(eks.files["eks/Dockerfile"]).toBeDefined();
      expect(eks.files["eks/Dockerfile"]).toContain("FROM node:24-slim");
    });

    it("includes app entry with /health", () => {
      expect(eks.files["eks/src/index.ts"]).toBeDefined();
      expect(eks.files["eks/src/index.ts"]).toContain("/health");
    });

    it("includes K8s deployment manifest", () => {
      expect(eks.files["eks/manifests/deployment.yaml"]).toBeDefined();
      expect(eks.files["eks/manifests/deployment.yaml"]).toContain("kind: Deployment");
      expect(eks.files["eks/manifests/deployment.yaml"]).toContain("livenessProbe");
      expect(eks.files["eks/manifests/deployment.yaml"]).toContain("readinessProbe");
    });

    it("includes K8s service manifest", () => {
      expect(eks.files["eks/manifests/service.yaml"]).toBeDefined();
      expect(eks.files["eks/manifests/service.yaml"]).toContain("kind: Service");
      expect(eks.files["eks/manifests/service.yaml"]).toContain("LoadBalancer");
    });

    it("includes eks package.json and tsconfig", () => {
      expect(eks.files["eks/package.json"]).toBeDefined();
      expect(eks.files["eks/tsconfig.json"]).toBeDefined();
    });
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = eks.iacContributions?.cdk;

    it("provides eks construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/eks.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/eks.ts"]).toContain("class EksCluster");
    });

    it("construct requires VPC prop", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/eks.ts"];
      expect(construct).toContain("vpc: ec2.IVpc");
    });

    it("construct enables cluster logging", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/eks.ts"];
      expect(construct).toContain("clusterLogging");
    });

    it("merges eks instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("EksCluster");
      expect(merge.constructs).toContain("EksCluster");
    });
  });

  // IaC contributions (Terraform)
  describe("iac contributions (terraform)", () => {
    const tfContrib = eks.iacContributions?.terraform;

    it("provides eks.tf with cluster and node group", () => {
      const tf = tfContrib?.files["infra/eks.tf"];
      expect(tf).toContain("aws_eks_cluster");
      expect(tf).toContain("aws_eks_node_group");
    });

    it("eks.tf includes IAM roles", () => {
      const tf = tfContrib?.files["infra/eks.tf"];
      expect(tf).toContain("aws_iam_role");
      expect(tf).toContain("eks_cluster");
      expect(tf).toContain("eks_node");
    });

    it("merges eks outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("eks_cluster_name");
      expect(outputs).toContain("eks_cluster_endpoint");
    });
  });

  // Merge contributions
  describe("merge contributions", () => {
    it("adds hadolint hook to lefthook pre-commit", () => {
      const lefthook = eks.merge["lefthook.yaml"] as Record<string, unknown>;
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
      eks,
    ];
    const registry = makeRegistry(...allPresets);

    it("auto-resolves vpc when eks is selected", () => {
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
      eks,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates eks app and manifest files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("eks/Dockerfile")).toBe(true);
      expect(result.hasFile("eks/src/index.ts")).toBe(true);
      expect(result.hasFile("eks/manifests/deployment.yaml")).toBe(true);
      expect(result.hasFile("eks/manifests/service.yaml")).toBe(true);
    });

    it("generates eks and vpc construct files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/eks.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/vpc.ts")).toBe(true);
    });

    it("substitutes projectName in manifests", () => {
      const result = generate(makeAnswers({ projectName: "test-app" }), registry);
      const deployment = result.readText("eks/manifests/deployment.yaml");
      expect(deployment).toContain("test-app");
      expect(deployment).not.toContain("{{projectName}}");
    });
  });

  // Integration (Terraform)
  describe("integration with generator (terraform)", () => {
    const allPresets = [createBasePreset(), createTerraformPreset(), createVpcPreset(), eks];
    const registry = makeRegistry(...allPresets);

    it("generates eks.tf and vpc.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/eks.tf")).toBe(true);
      expect(result.hasFile("infra/vpc.tf")).toBe(true);
    });
  });
});
