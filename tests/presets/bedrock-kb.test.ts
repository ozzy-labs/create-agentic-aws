import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createBedrockPreset } from "../../src/presets/bedrock.js";
import { createBedrockKbPreset } from "../../src/presets/bedrock-kb.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createTerraformPreset } from "../../src/presets/terraform.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: [],
    ai: ["bedrock-kb"],
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

describe("bedrock-kb preset", () => {
  const bedrockKb = createBedrockKbPreset();

  it("has name 'bedrock-kb'", () => {
    expect(bedrockKb.name).toBe("bedrock-kb");
  });

  it("requires bedrock", () => {
    expect(bedrockKb.requires).toContain("bedrock");
  });

  it("has no owned template files", () => {
    expect(Object.keys(bedrockKb.files)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // IaC contributions (CDK)
  // -------------------------------------------------------------------------

  describe("iac contributions (cdk)", () => {
    const cdkContrib = bedrockKb.iacContributions?.cdk;

    it("provides bedrock-kb construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/bedrock-kb.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/bedrock-kb.ts"]).toContain(
        "class BedrockKnowledgeBase",
      );
    });

    it("construct creates S3 bucket for data source", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/bedrock-kb.ts"];
      expect(construct).toContain("s3.Bucket");
      expect(construct).toContain("DataBucket");
    });

    it("construct creates knowledge base with embedding model", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/bedrock-kb.ts"];
      expect(construct).toContain("CfnKnowledgeBase");
      expect(construct).toContain("titan-embed-text-v2");
    });

    it("construct creates S3 data source", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/bedrock-kb.ts"];
      expect(construct).toContain("CfnDataSource");
      expect(construct).toContain("s3-data-source");
    });

    it("construct enforces encryption and blocks public access", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/bedrock-kb.ts"];
      expect(construct).toContain("BLOCK_ALL");
      expect(construct).toContain("enforceSSL: true");
    });

    it("merges bedrock-kb instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("BedrockKnowledgeBase");
      expect(merge.constructs).toContain("BedrockKnowledgeBase");
    });
  });

  // -------------------------------------------------------------------------
  // IaC contributions (Terraform)
  // -------------------------------------------------------------------------

  describe("iac contributions (terraform)", () => {
    const tfContrib = bedrockKb.iacContributions?.terraform;

    it("provides bedrock-kb.tf file", () => {
      const tf = tfContrib?.files["infra/bedrock-kb.tf"];
      expect(tf).toBeDefined();
      expect(tf).toContain("aws_bedrockagent_knowledge_base");
    });

    it("bedrock-kb.tf creates S3 bucket with security settings", () => {
      const tf = tfContrib?.files["infra/bedrock-kb.tf"];
      expect(tf).toContain("aws_s3_bucket");
      expect(tf).toContain("aws_s3_bucket_public_access_block");
      expect(tf).toContain("aws_s3_bucket_server_side_encryption_configuration");
    });

    it("bedrock-kb.tf creates IAM role for knowledge base", () => {
      const tf = tfContrib?.files["infra/bedrock-kb.tf"];
      expect(tf).toContain("aws_iam_role");
      expect(tf).toContain("bedrock.amazonaws.com");
    });

    it("bedrock-kb.tf creates S3 data source", () => {
      const tf = tfContrib?.files["infra/bedrock-kb.tf"];
      expect(tf).toContain("aws_bedrockagent_data_source");
      expect(tf).toContain("s3-data-source");
    });

    it("merges bedrock-kb outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("bedrock_kb_id");
      expect(outputs).toContain("bedrock_kb_data_bucket");
    });
  });

  // -------------------------------------------------------------------------
  // Dependency auto-resolution
  // -------------------------------------------------------------------------

  describe("dependency auto-resolution", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createBedrockPreset(),
      bedrockKb,
    ];
    const registry = makeRegistry(...allPresets);

    it("auto-resolves bedrock when bedrock-kb is selected", () => {
      const presets = resolvePresets(makeAnswers(), registry);
      const names = presets.map((p) => p.name);
      expect(names).toContain("bedrock");
    });
  });

  // -------------------------------------------------------------------------
  // Integration — CDK
  // -------------------------------------------------------------------------

  describe("integration with generator (cdk)", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createBedrockPreset(),
      bedrockKb,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates both bedrock and bedrock-kb construct files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/bedrock.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/bedrock-kb.ts")).toBe(true);
    });

    it("injects both imports into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("BedrockAccess");
      expect(appStack).toContain("BedrockKnowledgeBase");
    });

    it("merges Bedrock SDK into package.json", () => {
      const result = generate(makeAnswers(), registry);
      const pkg = result.readJson<{ dependencies: Record<string, string> }>("package.json");
      expect(pkg.dependencies["@aws-sdk/client-bedrock-runtime"]).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Integration — Terraform
  // -------------------------------------------------------------------------

  describe("integration with generator (terraform)", () => {
    const allPresets = [
      createBasePreset(),
      createTerraformPreset(),
      createBedrockPreset(),
      bedrockKb,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates both bedrock.tf and bedrock-kb.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/bedrock.tf")).toBe(true);
      expect(result.hasFile("infra/bedrock-kb.tf")).toBe(true);
    });

    it("merges both outputs into outputs.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("bedrock_policy_arn");
      expect(outputs).toContain("bedrock_kb_id");
    });
  });
});
