import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createS3Preset } from "../../src/presets/s3.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: [],
    data: ["s3"],
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

describe("s3 preset", () => {
  const s3 = createS3Preset();

  it("has name 's3'", () => {
    expect(s3.name).toBe("s3");
  });

  it("has no owned template files", () => {
    expect(Object.keys(s3.files)).toHaveLength(0);
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = s3.iacContributions?.cdk;

    it("provides s3 construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/s3.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/s3.ts"]).toContain("class S3Bucket");
    });

    it("construct enables encryption", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/s3.ts"];
      expect(construct).toContain("S3_MANAGED");
    });

    it("construct blocks public access", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/s3.ts"];
      expect(construct).toContain("BLOCK_ALL");
    });

    it("construct enforces SSL", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/s3.ts"];
      expect(construct).toContain("enforceSSL: true");
    });

    it("construct enables versioning", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/s3.ts"];
      expect(construct).toContain("versioned: true");
    });

    it("merges s3 instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("S3Bucket");
      expect(merge.constructs).toContain("new S3Bucket");
    });
  });

  // Integration with generator
  describe("integration with generator", () => {
    const allPresets = [createBasePreset(), createTypescriptPreset(), createCdkPreset(), s3];
    const registry = makeRegistry(...allPresets);

    it("generates s3 construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/s3.ts")).toBe(true);
    });

    it("injects s3 import into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('import { S3Bucket } from "./constructs/s3"');
    });

    it("injects s3 construct into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("new S3Bucket");
    });

    it("construct outputs bucket name", () => {
      const result = generate(makeAnswers(), registry);
      const construct = result.readText("infra/lib/constructs/s3.ts");
      expect(construct).toContain("CfnOutput");
      expect(construct).toContain("BucketName");
    });
  });
});
