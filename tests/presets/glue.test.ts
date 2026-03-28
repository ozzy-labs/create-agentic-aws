import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createGluePreset } from "../../src/presets/glue.js";
import { createPythonPreset } from "../../src/presets/python.js";
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
    dataPipeline: ["glue"],
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

describe("glue preset", () => {
  const glue = createGluePreset();

  it("has name 'glue'", () => {
    expect(glue.name).toBe("glue");
  });

  it("requires python", () => {
    expect(glue.requires).toContain("python");
  });

  it("has PySpark job template", () => {
    expect(glue.files["glue/jobs/etl_job.py"]).toBeDefined();
    expect(glue.files["glue/jobs/etl_job.py"]).toContain("GlueContext");
  });

  // -------------------------------------------------------------------------
  // IaC contributions (CDK)
  // -------------------------------------------------------------------------

  describe("iac contributions (cdk)", () => {
    const cdkContrib = glue.iacContributions?.cdk;

    it("provides glue construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/glue.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/glue.ts"]).toContain("class GlueEtl");
    });

    it("construct creates database and job", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/glue.ts"];
      expect(construct).toContain("CfnDatabase");
      expect(construct).toContain("CfnJob");
    });

    it("construct uses Glue 4.0", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/glue.ts"];
      expect(construct).toContain('"4.0"');
    });

    it("merges glue instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("GlueEtl");
      expect(merge.constructs).toContain("GlueEtl");
    });
  });

  // -------------------------------------------------------------------------
  // IaC contributions (Terraform)
  // -------------------------------------------------------------------------

  describe("iac contributions (terraform)", () => {
    const tfContrib = glue.iacContributions?.terraform;

    it("provides glue.tf file", () => {
      const tf = tfContrib?.files["infra/glue.tf"];
      expect(tf).toBeDefined();
      expect(tf).toContain("aws_glue_catalog_database");
      expect(tf).toContain("aws_glue_job");
    });

    it("glue.tf creates script bucket with security", () => {
      const tf = tfContrib?.files["infra/glue.tf"];
      expect(tf).toContain("aws_s3_bucket");
      expect(tf).toContain("aws_s3_bucket_public_access_block");
    });

    it("merges glue outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("glue_database_name");
      expect(outputs).toContain("glue_job_name");
    });
  });

  // -------------------------------------------------------------------------
  // Dependency: Python auto-resolution
  // -------------------------------------------------------------------------

  describe("python auto-resolution", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createPythonPreset(),
      glue,
    ];
    const registry = makeRegistry(...allPresets);

    it("auto-resolves python when glue is selected", () => {
      const presets = resolvePresets(makeAnswers(), registry);
      const names = presets.map((p) => p.name);
      expect(names).toContain("python");
    });
  });

  // -------------------------------------------------------------------------
  // Integration — CDK
  // -------------------------------------------------------------------------

  describe("integration with generator (cdk)", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createPythonPreset(),
      createCdkPreset(),
      glue,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates glue construct and job script files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/glue.ts")).toBe(true);
      expect(result.hasFile("glue/jobs/etl_job.py")).toBe(true);
    });

    it("substitutes projectName in job script", () => {
      const result = generate(makeAnswers(), registry);
      const script = result.readText("glue/jobs/etl_job.py");
      expect(script).toContain("my-project_db");
    });
  });

  // -------------------------------------------------------------------------
  // Integration — Terraform
  // -------------------------------------------------------------------------

  describe("integration with generator (terraform)", () => {
    const allPresets = [createBasePreset(), createPythonPreset(), createTerraformPreset(), glue];
    const registry = makeRegistry(...allPresets);

    it("generates glue.tf and job script", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/glue.tf")).toBe(true);
      expect(result.hasFile("glue/jobs/etl_job.py")).toBe(true);
    });

    it("merges glue outputs into outputs.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("glue_database_name");
    });
  });
});
