import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createEventBridgePreset } from "../../src/presets/eventbridge.js";
import { createTerraformPreset } from "../../src/presets/terraform.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: [],
    data: [],
    integration: ["eventbridge"],
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

describe("eventbridge preset", () => {
  const eb = createEventBridgePreset();

  it("has name 'eventbridge'", () => {
    expect(eb.name).toBe("eventbridge");
  });

  // Owned files (event schema boilerplate)
  describe("owned files", () => {
    it("includes event schema definitions", () => {
      expect(eb.files["lib/eventbridge/events.ts"]).toBeDefined();
      expect(eb.files["lib/eventbridge/events.ts"]).toContain("AppEvent");
    });

    it("includes event publisher", () => {
      expect(eb.files["lib/eventbridge/publisher.ts"]).toBeDefined();
      expect(eb.files["lib/eventbridge/publisher.ts"]).toContain("publishEvent");
      expect(eb.files["lib/eventbridge/publisher.ts"]).toContain("PutEventsCommand");
    });
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = eb.iacContributions?.cdk;

    it("provides eventbridge construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/eventbridge.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/eventbridge.ts"]).toContain("class EventBus");
    });

    it("construct creates event bus with archive", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/eventbridge.ts"];
      expect(construct).toContain("EventBus");
      expect(construct).toContain("archive");
    });

    it("merges eventbridge instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("EventBus");
      expect(merge.constructs).toContain("new EventBus");
    });
  });

  // IaC contributions (Terraform)
  describe("iac contributions (terraform)", () => {
    const tfContrib = eb.iacContributions?.terraform;

    it("provides eventbridge.tf with bus and archive", () => {
      const tf = tfContrib?.files["infra/eventbridge.tf"];
      expect(tf).toContain("aws_cloudwatch_event_bus");
      expect(tf).toContain("aws_cloudwatch_event_archive");
    });

    it("merges eventbridge outputs", () => {
      const outputs = tfContrib?.merge?.["infra/outputs.tf"] as string;
      expect(outputs).toContain("eventbridge_bus_name");
      expect(outputs).toContain("eventbridge_bus_arn");
    });
  });

  // Merge contributions
  describe("merge contributions", () => {
    it("adds AWS SDK EventBridge to root dependencies", () => {
      const pkg = eb.merge["package.json"] as Record<string, unknown>;
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps["@aws-sdk/client-eventbridge"]).toBeDefined();
    });
  });

  // Integration (CDK)
  describe("integration with generator (cdk)", () => {
    const registry = makeRegistry(
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      eb,
    );

    it("generates event schema and publisher files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("lib/eventbridge/events.ts")).toBe(true);
      expect(result.hasFile("lib/eventbridge/publisher.ts")).toBe(true);
    });

    it("generates eventbridge construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/eventbridge.ts")).toBe(true);
    });

    it("substitutes projectName in event schema", () => {
      const result = generate(makeAnswers({ projectName: "test-app" }), registry);
      const events = result.readText("lib/eventbridge/events.ts");
      expect(events).toContain("test-app");
    });
  });

  // Integration (Terraform)
  describe("integration with generator (terraform)", () => {
    const registry = makeRegistry(createBasePreset(), createTerraformPreset(), eb);

    it("generates eventbridge.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      expect(result.hasFile("infra/eventbridge.tf")).toBe(true);
    });

    it("merges eventbridge outputs into outputs.tf", () => {
      const result = generate(makeAnswers({ iac: "terraform" }), registry);
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("eventbridge_bus_name");
    });
  });
});
