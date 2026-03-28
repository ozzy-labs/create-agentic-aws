import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createRedshiftPreset } from "../../src/presets/redshift.js";
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
    data: [],
    dataPipeline: ["redshift"],
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

describe("redshift preset", () => {
  const redshift = createRedshiftPreset();

  it("has name 'redshift'", () => {
    expect(redshift.name).toBe("redshift");
  });

  it("has no owned template files", () => {
    expect(Object.keys(redshift.files)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // IaC contributions (CDK) — Serverless (default)
  // -------------------------------------------------------------------------

  describe("iac contributions (cdk) — serverless", () => {
    const cdkContrib = redshift.iacContributions?.cdk;

    it("provides redshift construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/redshift.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/redshift.ts"]).toContain(
        "class RedshiftServerless",
      );
    });

    it("construct creates namespace and workgroup", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/redshift.ts"];
      expect(construct).toContain("CfnNamespace");
      expect(construct).toContain("CfnWorkgroup");
    });

    it("construct uses managed admin password", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/redshift.ts"];
      expect(construct).toContain("manageAdminPassword: true");
    });

    it("merges redshift instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("RedshiftServerless");
      expect(merge.constructs).toContain("RedshiftServerless");
    });
  });

  // -------------------------------------------------------------------------
  // IaC contributions (Terraform) — Serverless (default)
  // -------------------------------------------------------------------------

  describe("iac contributions (terraform) — serverless", () => {
    const tfContrib = redshift.iacContributions?.terraform;

    it("provides redshift.tf with namespace and workgroup", () => {
      const tf = tfContrib?.files["infra/redshift.tf"];
      expect(tf).toContain("aws_redshiftserverless_namespace");
      expect(tf).toContain("aws_redshiftserverless_workgroup");
    });

    it("merges redshift outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("redshift_workgroup_endpoint");
      expect(outputs).toContain("redshift_namespace_name");
    });
  });

  // -------------------------------------------------------------------------
  // VPC auto-resolution
  // -------------------------------------------------------------------------

  describe("vpc auto-resolution", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createVpcPreset(),
      redshift,
    ];
    const registry = makeRegistry(...allPresets);

    it("auto-resolves vpc when redshift is selected", () => {
      const presets = resolvePresets(makeAnswers(), registry);
      const names = presets.map((p) => p.name);
      expect(names).toContain("vpc");
    });
  });

  // -------------------------------------------------------------------------
  // Integration — Serverless × CDK
  // -------------------------------------------------------------------------

  describe("integration with generator (serverless × cdk)", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createVpcPreset(),
      redshift,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates redshift construct file", () => {
      const result = generate(makeAnswers({ redshiftOptions: { mode: "serverless" } }), registry);
      expect(result.hasFile("infra/lib/constructs/redshift.ts")).toBe(true);
      const construct = result.readText("infra/lib/constructs/redshift.ts");
      expect(construct).toContain("RedshiftServerless");
    });
  });

  // -------------------------------------------------------------------------
  // Integration — Provisioned × CDK
  // -------------------------------------------------------------------------

  describe("integration with generator (provisioned × cdk)", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createVpcPreset(),
      redshift,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates provisioned cluster construct", () => {
      const result = generate(makeAnswers({ redshiftOptions: { mode: "provisioned" } }), registry);
      expect(result.hasFile("infra/lib/constructs/redshift.ts")).toBe(true);
      const construct = result.readText("infra/lib/constructs/redshift.ts");
      expect(construct).toContain("RedshiftCluster");
      expect(construct).toContain("CfnCluster");
    });

    it("injects provisioned import into app-stack.ts", () => {
      const result = generate(makeAnswers({ redshiftOptions: { mode: "provisioned" } }), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('import { RedshiftCluster } from "./constructs/redshift"');
    });
  });

  // -------------------------------------------------------------------------
  // Integration — Serverless × Terraform
  // -------------------------------------------------------------------------

  describe("integration with generator (serverless × terraform)", () => {
    const allPresets = [createBasePreset(), createTerraformPreset(), createVpcPreset(), redshift];
    const registry = makeRegistry(...allPresets);

    it("generates redshift.tf with serverless resources", () => {
      const result = generate(
        makeAnswers({ iac: "terraform", redshiftOptions: { mode: "serverless" } }),
        registry,
      );
      const tf = result.readText("infra/redshift.tf");
      expect(tf).toContain("aws_redshiftserverless_namespace");
    });
  });

  // -------------------------------------------------------------------------
  // Integration — Provisioned × Terraform
  // -------------------------------------------------------------------------

  describe("integration with generator (provisioned × terraform)", () => {
    const allPresets = [createBasePreset(), createTerraformPreset(), createVpcPreset(), redshift];
    const registry = makeRegistry(...allPresets);

    it("generates provisioned cluster redshift.tf", () => {
      const result = generate(
        makeAnswers({ iac: "terraform", redshiftOptions: { mode: "provisioned" } }),
        registry,
      );
      const tf = result.readText("infra/redshift.tf");
      expect(tf).toContain("aws_redshift_cluster");
      expect(tf).toContain("aws_redshift_subnet_group");
    });

    it("merges provisioned outputs", () => {
      const result = generate(
        makeAnswers({ iac: "terraform", redshiftOptions: { mode: "provisioned" } }),
        registry,
      );
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("redshift_cluster_endpoint");
      expect(outputs).not.toContain("redshift_workgroup_endpoint");
    });
  });

  // -------------------------------------------------------------------------
  // README content
  // -------------------------------------------------------------------------

  describe("readme content", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createVpcPreset(),
      redshift,
    ];
    const registry = makeRegistry(...allPresets);

    it("includes serverless label by default", () => {
      const result = generate(makeAnswers({ redshiftOptions: { mode: "serverless" } }), registry);
      const readme = result.readText("README.md");
      expect(readme).toContain("Serverless data warehouse (namespace + workgroup)");
    });

    it("includes provisioned label for provisioned mode", () => {
      const result = generate(makeAnswers({ redshiftOptions: { mode: "provisioned" } }), registry);
      const readme = result.readText("README.md");
      expect(readme).toContain("Provisioned data warehouse cluster");
    });
  });
});
