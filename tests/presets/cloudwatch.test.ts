import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator/index.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createCloudWatchPreset } from "../../src/presets/cloudwatch.js";
import { createEcsPreset } from "../../src/presets/ecs.js";
import { createLambdaPreset } from "../../src/presets/lambda.js";
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
    integration: [],
    networking: [],
    security: [],
    observability: ["cloudwatch"],
    languages: [],
    ...overrides,
  };
}

function makeRegistry(...presets: Preset[]): Map<PresetName, Preset> {
  return new Map(presets.map((p) => [p.name, p]));
}

describe("cloudwatch preset", () => {
  const cw = createCloudWatchPreset();

  it("has name 'cloudwatch'", () => {
    expect(cw.name).toBe("cloudwatch");
  });

  it("does not require lambda", () => {
    expect(cw.requires).toBeUndefined();
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = cw.iacContributions?.cdk;

    it("provides cloudwatch construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/cloudwatch.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/cloudwatch.ts"]).toContain(
        "class CloudWatchDashboard",
      );
    });

    it("construct creates standalone dashboard without lambda dependency", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/cloudwatch.ts"];
      expect(construct).toContain("Dashboard");
      expect(construct).toContain("dashboardName");
      expect(construct).not.toContain("lambda");
    });

    it("merges cloudwatch instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("CloudWatchDashboard");
      expect(merge.constructs).toContain("new CloudWatchDashboard");
    });
  });

  // Merge contributions
  describe("merge contributions", () => {
    it("has empty merge (no lambda-specific dependencies)", () => {
      expect(Object.keys(cw.merge)).toHaveLength(0);
    });
  });

  // Integration with generator
  describe("integration with generator (with Lambda)", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createLambdaPreset(),
      cw,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates cloudwatch construct file", () => {
      const result = generate(makeAnswers({ compute: ["lambda"] }), registry);
      expect(result.hasFile("infra/lib/constructs/cloudwatch.ts")).toBe(true);
    });

    it("injects cloudwatch import into app-stack.ts", () => {
      const result = generate(makeAnswers({ compute: ["lambda"] }), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('import { CloudWatchDashboard } from "./constructs/cloudwatch"');
    });

    it("injects cloudwatch construct into app-stack.ts", () => {
      const result = generate(makeAnswers({ compute: ["lambda"] }), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("new CloudWatchDashboard");
    });
  });

  // Integration WITHOUT Lambda — key scenario for this fix
  describe("integration with generator (without Lambda)", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createVpcPreset(),
      createEcsPreset(),
      cw,
    ];
    const registry = makeRegistry(...allPresets);

    it("does not generate lambda files", () => {
      const result = generate(makeAnswers({ compute: ["ecs"] }), registry);
      expect(result.hasFile("lambda/handlers/index.ts")).toBe(false);
      expect(result.hasFile("infra/lib/constructs/lambda.ts")).toBe(false);
    });

    it("generates cloudwatch construct without lambda reference", () => {
      const result = generate(makeAnswers({ compute: ["ecs"] }), registry);
      const construct = result.readText("infra/lib/constructs/cloudwatch.ts");
      expect(construct).toContain("class CloudWatchDashboard");
      expect(construct).not.toContain("lambda");
    });

    it("app-stack.ts does not reference lambdaFunction", () => {
      const result = generate(makeAnswers({ compute: ["ecs"] }), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("CloudWatchDashboard");
      expect(appStack).not.toContain("lambdaFunction");
    });
  });
});
