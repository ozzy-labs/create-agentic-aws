import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createCloudWatchPreset } from "../../src/presets/cloudwatch.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: [],
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

  // Owned files (Powertools integration)
  describe("owned files", () => {
    it("includes observability index with Logger/Tracer/Metrics", () => {
      expect(cw.files["lib/observability/index.ts"]).toBeDefined();
      expect(cw.files["lib/observability/index.ts"]).toContain("Logger");
      expect(cw.files["lib/observability/index.ts"]).toContain("Tracer");
      expect(cw.files["lib/observability/index.ts"]).toContain("Metrics");
    });

    it("includes middleware wrapper", () => {
      expect(cw.files["lib/observability/middleware.ts"]).toBeDefined();
      expect(cw.files["lib/observability/middleware.ts"]).toContain("withObservability");
      expect(cw.files["lib/observability/middleware.ts"]).toContain("middy");
    });
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

    it("construct creates dashboard", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/cloudwatch.ts"];
      expect(construct).toContain("Dashboard");
      expect(construct).toContain("dashboardName");
    });

    it("merges cloudwatch instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("CloudWatchDashboard");
      expect(merge.constructs).toContain("new CloudWatchDashboard");
    });
  });

  // Merge contributions
  describe("merge contributions", () => {
    it("adds Powertools and middy to root dependencies", () => {
      const pkg = cw.merge["package.json"] as Record<string, unknown>;
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps["@aws-lambda-powertools/logger"]).toBeDefined();
      expect(deps["@aws-lambda-powertools/metrics"]).toBeDefined();
      expect(deps["@aws-lambda-powertools/tracer"]).toBeDefined();
      expect(deps["@middy/core"]).toBeDefined();
    });
  });

  // Integration with generator
  describe("integration with generator", () => {
    const allPresets = [createBasePreset(), createTypescriptPreset(), createCdkPreset(), cw];
    const registry = makeRegistry(...allPresets);

    it("generates observability files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("lib/observability/index.ts")).toBe(true);
      expect(result.hasFile("lib/observability/middleware.ts")).toBe(true);
    });

    it("generates cloudwatch construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/cloudwatch.ts")).toBe(true);
    });

    it("injects cloudwatch import into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('import { CloudWatchDashboard } from "./constructs/cloudwatch"');
    });

    it("injects cloudwatch construct into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("new CloudWatchDashboard");
    });

    it("substitutes projectName in observability index", () => {
      const result = generate(makeAnswers({ projectName: "test-app" }), registry);
      const index = result.readText("lib/observability/index.ts");
      expect(index).toContain('serviceName: "test-app"');
    });
  });
});
