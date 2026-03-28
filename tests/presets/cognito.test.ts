import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createCognitoPreset } from "../../src/presets/cognito.js";
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
    integration: [],
    networking: [],
    security: ["cognito"],
    observability: [],
    languages: [],
    ...overrides,
  };
}

function makeRegistry(...presets: Preset[]): Map<PresetName, Preset> {
  return new Map(presets.map((p) => [p.name, p]));
}

describe("cognito preset", () => {
  const cognito = createCognitoPreset();

  it("has name 'cognito'", () => {
    expect(cognito.name).toBe("cognito");
  });

  it("has no owned template files", () => {
    expect(Object.keys(cognito.files)).toHaveLength(0);
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = cognito.iacContributions?.cdk;

    it("provides cognito construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/cognito.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/cognito.ts"]).toContain("class CognitoAuth");
    });

    it("construct creates user pool with email sign-in", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/cognito.ts"];
      expect(construct).toContain("signInAliases");
      expect(construct).toContain("email: true");
    });

    it("construct has password policy", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/cognito.ts"];
      expect(construct).toContain("passwordPolicy");
      expect(construct).toContain("requireSymbols");
    });

    it("construct creates app client", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/cognito.ts"];
      expect(construct).toContain("addClient");
      expect(construct).toContain("preventUserExistenceErrors");
    });

    it("merges cognito instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("CognitoAuth");
      expect(merge.constructs).toContain("new CognitoAuth");
    });
  });

  // Integration with generator
  describe("integration with generator", () => {
    const allPresets = [createBasePreset(), createTypescriptPreset(), createCdkPreset(), cognito];
    const registry = makeRegistry(...allPresets);

    it("generates cognito construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/cognito.ts")).toBe(true);
    });

    it("injects cognito import into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('import { CognitoAuth } from "./constructs/cognito"');
    });

    it("injects cognito construct into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("new CognitoAuth");
    });

    it("construct outputs user pool and client IDs", () => {
      const result = generate(makeAnswers(), registry);
      const construct = result.readText("infra/lib/constructs/cognito.ts");
      expect(construct).toContain("UserPoolId");
      expect(construct).toContain("UserPoolClientId");
    });
  });
});
