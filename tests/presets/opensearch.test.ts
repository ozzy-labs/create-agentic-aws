import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createOpenSearchPreset } from "../../src/presets/opensearch.js";
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
    ai: ["opensearch"],
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

describe("opensearch preset", () => {
  const opensearch = createOpenSearchPreset();

  it("has name 'opensearch'", () => {
    expect(opensearch.name).toBe("opensearch");
  });

  it("has no owned template files", () => {
    expect(Object.keys(opensearch.files)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // IaC contributions (CDK) — Serverless (default)
  // -------------------------------------------------------------------------

  describe("iac contributions (cdk) — serverless", () => {
    const cdkContrib = opensearch.iacContributions?.cdk;

    it("provides opensearch construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/opensearch.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/opensearch.ts"]).toContain(
        "class OpenSearchCollection",
      );
    });

    it("construct creates encryption and network policies", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/opensearch.ts"];
      expect(construct).toContain("CfnSecurityPolicy");
      expect(construct).toContain('"encryption"');
      expect(construct).toContain('"network"');
    });

    it("construct creates a collection", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/opensearch.ts"];
      expect(construct).toContain("CfnCollection");
      expect(construct).toContain('"SEARCH"');
    });

    it("merges opensearch instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("OpenSearchCollection");
      expect(merge.constructs).toContain("OpenSearchCollection");
    });
  });

  // -------------------------------------------------------------------------
  // IaC contributions (Terraform) — Serverless (default)
  // -------------------------------------------------------------------------

  describe("iac contributions (terraform) — serverless", () => {
    const tfContrib = opensearch.iacContributions?.terraform;

    it("provides opensearch.tf with security policies and collection", () => {
      const tf = tfContrib?.files["infra/opensearch.tf"];
      expect(tf).toContain("aws_opensearchserverless_security_policy");
      expect(tf).toContain("aws_opensearchserverless_access_policy");
      expect(tf).toContain("aws_opensearchserverless_collection");
    });

    it("opensearch.tf includes encryption policy", () => {
      const tf = tfContrib?.files["infra/opensearch.tf"];
      expect(tf).toContain('"encryption"');
      expect(tf).toContain("AWSOwnedKey");
    });

    it("merges opensearch outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("opensearch_collection_endpoint");
      expect(outputs).toContain("opensearch_collection_arn");
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
      opensearch,
    ];
    const registry = makeRegistry(...allPresets);

    it("does not auto-resolve vpc for serverless mode", () => {
      const presets = resolvePresets(
        makeAnswers({ openSearchOptions: { mode: "serverless" } }),
        registry,
      );
      const names = presets.map((p) => p.name);
      expect(names).not.toContain("vpc");
    });

    it("auto-resolves vpc for managed-cluster mode", () => {
      const presets = resolvePresets(
        makeAnswers({ openSearchOptions: { mode: "managed-cluster" } }),
        registry,
      );
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
      opensearch,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates opensearch construct file", () => {
      const result = generate(makeAnswers({ openSearchOptions: { mode: "serverless" } }), registry);
      expect(result.hasFile("infra/lib/constructs/opensearch.ts")).toBe(true);
      const construct = result.readText("infra/lib/constructs/opensearch.ts");
      expect(construct).toContain("OpenSearchCollection");
    });

    it("injects opensearch import into app-stack.ts", () => {
      const result = generate(makeAnswers({ openSearchOptions: { mode: "serverless" } }), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('import { OpenSearchCollection } from "./constructs/opensearch"');
    });
  });

  // -------------------------------------------------------------------------
  // Integration — Managed Cluster × CDK
  // -------------------------------------------------------------------------

  describe("integration with generator (managed-cluster × cdk)", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createVpcPreset(),
      opensearch,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates managed domain construct file", () => {
      const result = generate(
        makeAnswers({ openSearchOptions: { mode: "managed-cluster" } }),
        registry,
      );
      expect(result.hasFile("infra/lib/constructs/opensearch.ts")).toBe(true);
      const construct = result.readText("infra/lib/constructs/opensearch.ts");
      expect(construct).toContain("OpenSearchDomain");
      expect(construct).toContain("vpc: ec2.IVpc");
    });

    it("injects domain import into app-stack.ts", () => {
      const result = generate(
        makeAnswers({ openSearchOptions: { mode: "managed-cluster" } }),
        registry,
      );
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('import { OpenSearchDomain } from "./constructs/opensearch"');
      expect(appStack).toContain("vpc: vpc.vpc");
    });
  });

  // -------------------------------------------------------------------------
  // Integration — Serverless × Terraform
  // -------------------------------------------------------------------------

  describe("integration with generator (serverless × terraform)", () => {
    const allPresets = [createBasePreset(), createTerraformPreset(), opensearch];
    const registry = makeRegistry(...allPresets);

    it("generates opensearch.tf", () => {
      const result = generate(
        makeAnswers({ iac: "terraform", openSearchOptions: { mode: "serverless" } }),
        registry,
      );
      expect(result.hasFile("infra/opensearch.tf")).toBe(true);
      const tf = result.readText("infra/opensearch.tf");
      expect(tf).toContain("aws_opensearchserverless_collection");
    });

    it("merges opensearch outputs into outputs.tf", () => {
      const result = generate(
        makeAnswers({ iac: "terraform", openSearchOptions: { mode: "serverless" } }),
        registry,
      );
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("opensearch_collection_endpoint");
    });
  });

  // -------------------------------------------------------------------------
  // Integration — Managed Cluster × Terraform
  // -------------------------------------------------------------------------

  describe("integration with generator (managed-cluster × terraform)", () => {
    const allPresets = [createBasePreset(), createTerraformPreset(), createVpcPreset(), opensearch];
    const registry = makeRegistry(...allPresets);

    it("generates managed domain opensearch.tf", () => {
      const result = generate(
        makeAnswers({ iac: "terraform", openSearchOptions: { mode: "managed-cluster" } }),
        registry,
      );
      expect(result.hasFile("infra/opensearch.tf")).toBe(true);
      const tf = result.readText("infra/opensearch.tf");
      expect(tf).toContain("aws_opensearch_domain");
      expect(tf).toContain("aws_security_group");
    });

    it("merges domain outputs into outputs.tf", () => {
      const result = generate(
        makeAnswers({ iac: "terraform", openSearchOptions: { mode: "managed-cluster" } }),
        registry,
      );
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("opensearch_domain_endpoint");
      expect(outputs).toContain("opensearch_domain_arn");
    });

    it("does not contain serverless outputs", () => {
      const result = generate(
        makeAnswers({ iac: "terraform", openSearchOptions: { mode: "managed-cluster" } }),
        registry,
      );
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).not.toContain("opensearch_collection_endpoint");
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
      opensearch,
    ];
    const registry = makeRegistry(...allPresets);

    it("includes serverless label for serverless mode", () => {
      const result = generate(makeAnswers({ openSearchOptions: { mode: "serverless" } }), registry);
      const readme = result.readText("README.md");
      expect(readme).toContain("Serverless search and analytics collection");
    });

    it("includes managed cluster label for managed-cluster mode", () => {
      const result = generate(
        makeAnswers({ openSearchOptions: { mode: "managed-cluster" } }),
        registry,
      );
      const readme = result.readText("README.md");
      expect(readme).toContain("Amazon OpenSearch Service");
      expect(readme).toContain("Managed search and analytics cluster (VPC)");
      expect(readme).not.toContain("Amazon OpenSearch Serverless");
    });
  });
});
