import { describe, expect, it } from "vitest";

import { generate } from "../../src/generator.js";
import { createBasePreset } from "../../src/presets/base.js";
import { createCdkPreset } from "../../src/presets/cdk.js";
import { createDynamoDbPreset } from "../../src/presets/dynamodb.js";
import { createTypescriptPreset } from "../../src/presets/typescript.js";
import type { Preset, PresetName, WizardAnswers } from "../../src/types.js";

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    projectName: "my-project",
    agents: [],
    iac: "cdk",
    compute: [],
    ai: [],
    data: ["dynamodb"],
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

describe("dynamodb preset", () => {
  const dynamodb = createDynamoDbPreset();

  it("has name 'dynamodb'", () => {
    expect(dynamodb.name).toBe("dynamodb");
  });

  // Owned files (DAL boilerplate)
  describe("owned files", () => {
    it("includes DynamoDB client", () => {
      expect(dynamodb.files["lib/dynamodb/client.ts"]).toBeDefined();
      expect(dynamodb.files["lib/dynamodb/client.ts"]).toContain("DynamoDBDocumentClient");
    });

    it("includes repository boilerplate", () => {
      expect(dynamodb.files["lib/dynamodb/repository.ts"]).toBeDefined();
      expect(dynamodb.files["lib/dynamodb/repository.ts"]).toContain("getItem");
      expect(dynamodb.files["lib/dynamodb/repository.ts"]).toContain("putItem");
      expect(dynamodb.files["lib/dynamodb/repository.ts"]).toContain("queryItems");
    });
  });

  // IaC contributions (CDK)
  describe("iac contributions (cdk)", () => {
    const cdkContrib = dynamodb.iacContributions?.cdk;

    it("provides dynamodb construct file", () => {
      expect(cdkContrib?.files["infra/lib/constructs/dynamodb.ts"]).toBeDefined();
      expect(cdkContrib?.files["infra/lib/constructs/dynamodb.ts"]).toContain(
        "class DynamoDbTable",
      );
    });

    it("construct uses PAY_PER_REQUEST billing", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/dynamodb.ts"];
      expect(construct).toContain("PAY_PER_REQUEST");
    });

    it("construct enables point-in-time recovery", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/dynamodb.ts"];
      expect(construct).toContain("pointInTimeRecovery: true");
    });

    it("construct uses pk/sk key schema", () => {
      const construct = cdkContrib?.files["infra/lib/constructs/dynamodb.ts"];
      expect(construct).toContain('"pk"');
      expect(construct).toContain('"sk"');
    });

    it("merges dynamodb instantiation into app-stack.ts", () => {
      const merge = cdkContrib?.merge?.["infra/lib/app-stack.ts"] as Record<string, string>;
      expect(merge.imports).toContain("DynamoDbTable");
      expect(merge.constructs).toContain("new DynamoDbTable");
    });
  });

  // Merge contributions
  describe("merge contributions", () => {
    it("adds AWS SDK DynamoDB to root dependencies", () => {
      const pkg = dynamodb.merge["package.json"] as Record<string, unknown>;
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps["@aws-sdk/client-dynamodb"]).toBeDefined();
      expect(deps["@aws-sdk/lib-dynamodb"]).toBeDefined();
    });
  });

  // Integration with generator
  describe("integration with generator", () => {
    const allPresets = [createBasePreset(), createTypescriptPreset(), createCdkPreset(), dynamodb];
    const registry = makeRegistry(...allPresets);

    it("generates DAL files", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("lib/dynamodb/client.ts")).toBe(true);
      expect(result.hasFile("lib/dynamodb/repository.ts")).toBe(true);
    });

    it("generates dynamodb construct file", () => {
      const result = generate(makeAnswers(), registry);
      expect(result.hasFile("infra/lib/constructs/dynamodb.ts")).toBe(true);
    });

    it("injects dynamodb import into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('import { DynamoDbTable } from "./constructs/dynamodb"');
    });

    it("injects dynamodb construct into app-stack.ts", () => {
      const result = generate(makeAnswers(), registry);
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("new DynamoDbTable");
    });

    it("merges AWS SDK into root package.json dependencies", () => {
      const result = generate(makeAnswers(), registry);
      const pkg = result.readJson<{ dependencies: Record<string, string> }>("package.json");
      expect(pkg.dependencies["@aws-sdk/client-dynamodb"]).toBeDefined();
    });
  });
});
