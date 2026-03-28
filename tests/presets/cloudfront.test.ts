import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createCloudFrontPreset } from "../../src/presets/cloudfront.js";
import { createS3Preset } from "../../src/presets/s3.js";
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
    networking: ["cloudfront"],
    security: [],
    observability: [],
    languages: [],
    ...overrides,
  };
}

function makeRegistry(...presets: Preset[]): Map<PresetName, Preset> {
  return new Map(presets.map((p) => [p.name, p]));
}

describe("cloudfront preset", () => {
  const cloudfront = createCloudFrontPreset();

  it("has name 'cloudfront'", () => {
    expect(cloudfront.name).toBe("cloudfront");
  });

  it("has no owned template files", () => {
    expect(Object.keys(cloudfront.files)).toHaveLength(0);
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = cloudfront.iacContributions?.cdk;

    it("provides cloudfront construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/cloudfront.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/cloudfront.ts"]).toContain(
        "class CloudFrontDistribution",
      );
    });

    it("construct uses S3 origin with OAC", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/cloudfront.ts"];
      expect(construct).toContain("S3BucketOrigin");
      expect(construct).toContain("withOriginAccessControl");
    });

    it("construct enforces HTTPS", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/cloudfront.ts"];
      expect(construct).toContain("REDIRECT_TO_HTTPS");
    });

    it("construct uses TLS 1.2", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/cloudfront.ts"];
      expect(construct).toContain("TLS_V1_2_2021");
    });

    it("construct requires origin bucket", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/cloudfront.ts"];
      expect(construct).toContain("originBucket: s3.IBucket");
    });

    it("merges cloudfront instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("CloudFrontDistribution");
      expect(merge.constructs).toContain("new CloudFrontDistribution");
    });
  });

  // Integration with generator
  describe("integration with generator", () => {
    const allPresets = [
      createBasePreset(),
      createTypescriptPreset(),
      createCdkPreset(),
      createS3Preset(),
      cloudfront,
    ];
    const registry = makeRegistry(...allPresets);

    it("generates cloudfront construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/cloudfront.ts")).toBe(true);
    });

    it("injects cloudfront import into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain(
        'import { CloudFrontDistribution } from "./constructs/cloudfront"',
      );
    });

    it("injects cloudfront construct into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("new CloudFrontDistribution");
    });

    it("construct outputs distribution domain and ID", () => {
      const result = generate(makeAnswers(), registry);
      const construct = result.readText("infra/lib/constructs/cloudfront.ts");
      expect(construct).toContain("DistributionDomainName");
      expect(construct).toContain("DistributionId");
    });
  });
});
