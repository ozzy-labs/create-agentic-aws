import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createStepFunctionsPreset } from "../../src/presets/step-functions.js";
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
    integration: ["step-functions"],
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

describe("step-functions preset", () => {
  const sfn = createStepFunctionsPreset();

  it("has name 'step-functions'", () => {
    expect(sfn.name).toBe("step-functions");
  });

  // Owned files
  describe("owned files", () => {
    it("has no owned files (workflow defined in CDK construct / TF)", () => {
      expect(Object.keys(sfn.files)).toHaveLength(0);
    });
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = sfn.iacContributions?.cdk;

    it("provides step-functions construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/step-functions.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/step-functions.ts"]).toContain(
        "class StepFunctionsWorkflow",
      );
    });

    it("construct creates state machine with logging", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/step-functions.ts"];
      expect(construct).toContain("StateMachine");
      expect(construct).toContain("LogGroup");
      expect(construct).toContain("tracingEnabled: true");
    });

    it("merges step-functions instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("StepFunctionsWorkflow");
      expect(merge.constructs).toContain("new StepFunctionsWorkflow");
    });
  });

  // IaC contributions (Terraform)
  describe("iac contributions (terraform)", () => {
    const tfContrib = sfn.iacContributions?.terraform;

    it("provides step-functions.tf with state machine", () => {
      const tf = tfContrib?.files["infra/step-functions.tf"];
      expect(tf).toContain("aws_sfn_state_machine");
    });

    it("step-functions.tf includes logging and tracing", () => {
      const tf = tfContrib?.files["infra/step-functions.tf"];
      expect(tf).toContain("logging_configuration");
      expect(tf).toContain("tracing_configuration");
    });

    it("step-functions.tf includes IAM role", () => {
      const tf = tfContrib?.files["infra/step-functions.tf"];
      expect(tf).toContain("aws_iam_role");
    });

    it("merges step-functions outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("step_functions_state_machine_arn");
    });
  });

  // Integration (CDK)
  describe("integration with generator (cdk)", () => {
    const registry = makeRegistry(
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      sfn,
    );

    it("generates construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/step-functions.ts")).toBe(true);
    });
  });

  // Integration (Terraform)
  describe("integration with generator (terraform)", () => {
    const registry = makeRegistry(createBasePreset(), createTerraformPreset(), sfn);

    it("generates step-functions.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/step-functions.tf")).toBe(true);
    });

    it("merges step-functions outputs into outputs.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("step_functions_state_machine_arn");
    });
  });
});
