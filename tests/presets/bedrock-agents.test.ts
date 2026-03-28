import { describe, expect, it } from "vitest";

import { generate, resolvePresets } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createBedrockPreset } from "../../src/presets/bedrock.js";
import { createBedrockAgentsPreset } from "../../src/presets/bedrock-agents.js";
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
    ai: ["bedrock-agents"],
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

describe("bedrock-agents preset", () => {
  const bedrockAgents = createBedrockAgentsPreset();

  it("has name 'bedrock-agents'", () => {
    expect(bedrockAgents.name).toBe("bedrock-agents");
  });

  it("requires bedrock-kb", () => {
    expect(bedrockAgents.requires).toContain("bedrock-kb");
  });

  it("has action group handler template", () => {
    expect(bedrockAgents.files["lambda/handlers/action-group.ts"]).toBeDefined();
    expect(bedrockAgents.files["lambda/handlers/action-group.ts"]).toContain("ActionGroupEvent");
  });

  // -------------------------------------------------------------------------
  // IaC contributions (CDK)
  // -------------------------------------------------------------------------

  describe("iac contributions (cdk)", () => {
    const cdkContrib = bedrockAgents.iacContributions?.cdk;

    it("provides bedrock-agents construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/bedrock-agents.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/bedrock-agents.ts"]).toContain(
        "class BedrockAgent",
      );
    });

    it("construct creates agent with foundation model", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/bedrock-agents.ts"];
      expect(construct).toContain("CfnAgent");
      expect(construct).toContain("foundationModel");
    });

    it("construct creates Lambda function internally", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/bedrock-agents.ts"];
      expect(construct).toContain("new lambda.Function");
      expect(construct).toContain("ActionGroupFunction");
      expect(construct).not.toContain("BedrockAgentProps");
    });

    it("construct includes action group configuration", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/bedrock-agents.ts"];
      expect(construct).toContain("actionGroups");
      expect(construct).toContain("actionGroupExecutor");
    });

    it("construct grants Lambda invoke permission to Bedrock", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/bedrock-agents.ts"];
      expect(construct).toContain("addPermission");
      expect(construct).toContain("bedrock.amazonaws.com");
    });

    it("merges bedrock-agents instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("BedrockAgent");
      expect(merge.constructs).toContain("BedrockAgent");
    });
  });

  // -------------------------------------------------------------------------
  // IaC contributions (Terraform)
  // -------------------------------------------------------------------------

  describe("iac contributions (terraform)", () => {
    const tfContrib = bedrockAgents.iacContributions?.terraform;

    it("provides bedrock-agents.tf file", () => {
      const tf = tfContrib?.files["infra/bedrock-agents.tf"];
      expect(tf).toBeDefined();
      expect(tf).toContain("aws_bedrockagent_agent");
    });

    it("bedrock-agents.tf creates action group Lambda", () => {
      const tf = tfContrib?.files["infra/bedrock-agents.tf"];
      expect(tf).toContain("aws_lambda_function");
      expect(tf).toContain("action-group");
    });

    it("bedrock-agents.tf creates action group with API schema", () => {
      const tf = tfContrib?.files["infra/bedrock-agents.tf"];
      expect(tf).toContain("aws_bedrockagent_agent_action_group");
      expect(tf).toContain("api_schema");
    });

    it("bedrock-agents.tf grants Lambda invoke permission", () => {
      const tf = tfContrib?.files["infra/bedrock-agents.tf"];
      expect(tf).toContain("aws_lambda_permission");
      expect(tf).toContain("AllowBedrockAgentInvoke");
    });

    it("merges bedrock-agents outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("bedrock_agent_id");
      expect(outputs).toContain("bedrock_agent_action_group_lambda_arn");
    });
  });

  // -------------------------------------------------------------------------
  // Dependency chain: bedrock-agents → bedrock-kb → bedrock
  // -------------------------------------------------------------------------

  describe("dependency chain", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createBedrockPreset(),
      createBedrockKbPreset(),
      bedrockAgents,
    ];
    const registry = makeRegistry(...allPresets);

    it("auto-resolves bedrock-kb and bedrock when bedrock-agents is selected", () => {
      const presets = resolvePresets(makeAnswers(), registry);
      const names = presets.map((p) => p.name);
      expect(names).toContain("bedrock");
      expect(names).toContain("bedrock-kb");
      expect(names).toContain("bedrock-agents");
    });

    it("preserves canonical preset order", () => {
      const presets = resolvePresets(makeAnswers(), registry);
      const names = presets.map((p) => p.name);
      const bedrockIdx = names.indexOf("bedrock");
      const kbIdx = names.indexOf("bedrock-kb");
      const agentsIdx = names.indexOf("bedrock-agents");
      expect(bedrockIdx).toBeLessThan(kbIdx);
      expect(kbIdx).toBeLessThan(agentsIdx);
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
      createBedrockKbPreset(),
      bedrockAgents,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates all bedrock chain construct files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/bedrock.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/bedrock-kb.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/bedrock-agents.ts")).toBe(true);
    });

    it("generates action group handler template", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("lambda/handlers/action-group.ts")).toBe(true);
    });

    it("injects all imports into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("BedrockAccess");
      expect(appStack).toContain("BedrockKnowledgeBase");
      expect(appStack).toContain("BedrockAgent");
    });

    it("app-stack.ts does not contain undefined!", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).not.toContain("undefined!");
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
      createBedrockKbPreset(),
      bedrockAgents,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates all bedrock chain .tf files", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/bedrock.tf")).toBe(true);
      expect(result.hasFile("infra/bedrock-kb.tf")).toBe(true);
      expect(result.hasFile("infra/bedrock-agents.tf")).toBe(true);
    });

    it("merges all outputs into outputs.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("bedrock_policy_arn");
      expect(outputs).toContain("bedrock_kb_id");
      expect(outputs).toContain("bedrock_agent_id");
    });
  });
});
