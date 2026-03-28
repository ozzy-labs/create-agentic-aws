import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createApiGatewayPreset } from "../../src/presets/api-gateway.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
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
    networking: ["api-gateway"],
    security: [],
    observability: [],
    languages: [],
    ...overrides,
  };
}

function makeRegistry(...presets: Preset[]): Map<PresetName, Preset> {
  return new Map(presets.map((p) => [p.name, p]));
}

describe("api-gateway preset", () => {
  const apiGateway = createApiGatewayPreset();

  it("has name 'api-gateway'", () => {
    expect(apiGateway.name).toBe("api-gateway");
  });

  it("has no owned template files", () => {
    expect(Object.keys(apiGateway.files)).toHaveLength(0);
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = apiGateway.iacContributions?.cdk;

    it("provides api-gateway construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/api-gateway.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/api-gateway.ts"]).toContain(
        "class ApiGateway",
      );
    });

    it("construct supports REST API type", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/api-gateway.ts"];
      expect(construct).toContain("RestApi");
    });

    it("construct supports HTTP API type", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/api-gateway.ts"];
      expect(construct).toContain("HttpApi");
    });

    it("construct accepts type prop", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/api-gateway.ts"];
      expect(construct).toContain('readonly type: "rest" | "http"');
    });

    it("merges api-gateway instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("ApiGateway");
      expect(merge.constructs).toContain("new ApiGateway");
    });
  });

  // Integration with generator
  describe("integration with generator", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      apiGateway,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates api-gateway construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/api-gateway.ts")).toBe(true);
    });

    it("injects api-gateway import into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('import { ApiGateway } from "./constructs/api-gateway"');
    });

    it("injects api-gateway construct into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("new ApiGateway");
    });

    it("construct includes CORS configuration", () => {
      const result = generate(makeAnswers(), registry);
      const construct = result.readText("infra/lib/constructs/api-gateway.ts");
      expect(construct).toContain("Cors");
      expect(construct).toContain("corsPreflight");
    });

    it("construct outputs API URL", () => {
      const result = generate(makeAnswers(), registry);
      const construct = result.readText("infra/lib/constructs/api-gateway.ts");
      expect(construct).toContain("CfnOutput");
    });
  });
});
