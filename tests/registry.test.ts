import { describe, expect, it } from "vitest";
import { createRegistry, validateRegistry } from "../src/presets/registry.js";
import type { Preset, PresetName } from "../src/types.js";

describe("createRegistry", () => {
  const registry = createRegistry();

  it("includes base preset", () => {
    expect(registry.has("base")).toBe(true);
  });

  it("includes language presets", () => {
    expect(registry.has("typescript")).toBe(true);
    expect(registry.has("python")).toBe(true);
  });

  it("includes agent presets", () => {
    expect(registry.has("amazon-q")).toBe(true);
    expect(registry.has("claude-code")).toBe(true);
    expect(registry.has("copilot")).toBe(true);
  });

  it("includes iac presets", () => {
    expect(registry.has("cdk")).toBe(true);
    expect(registry.has("terraform")).toBe(true);
  });

  it("includes service presets", () => {
    expect(registry.has("lambda")).toBe(true);
    expect(registry.has("api-gateway")).toBe(true);
    expect(registry.has("s3")).toBe(true);
    expect(registry.has("dynamodb")).toBe(true);
    expect(registry.has("sqs")).toBe(true);
    expect(registry.has("cloudfront")).toBe(true);
    expect(registry.has("cognito")).toBe(true);
    expect(registry.has("cloudwatch")).toBe(true);
    expect(registry.has("vpc")).toBe(true);
    expect(registry.has("ecs")).toBe(true);
    expect(registry.has("eks")).toBe(true);
    expect(registry.has("ec2")).toBe(true);
    expect(registry.has("aurora")).toBe(true);
    expect(registry.has("rds")).toBe(true);
    expect(registry.has("sns")).toBe(true);
    expect(registry.has("eventbridge")).toBe(true);
    expect(registry.has("step-functions")).toBe(true);
  });

  it("has correct preset count", () => {
    // base + 2 languages + 3 agents + 2 IaC + 22 services + 1 infra = 31
    expect(registry.size).toBe(31);
  });

  it("passes validation (no circular deps, no missing refs)", () => {
    expect(() => validateRegistry(registry)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateRegistry
// ---------------------------------------------------------------------------

function makePreset(name: PresetName, requires?: PresetName[]): Preset {
  return { name, files: {}, merge: {}, requires };
}

describe("validateRegistry", () => {
  it("accepts a valid registry with no requires", () => {
    const reg = new Map<PresetName, Preset>([
      ["base", makePreset("base")],
      ["cdk", makePreset("cdk")],
    ]);
    expect(() => validateRegistry(reg)).not.toThrow();
  });

  it("accepts a valid registry with linear requires", () => {
    const reg = new Map<PresetName, Preset>([
      ["base", makePreset("base")],
      ["cdk", makePreset("cdk", ["typescript"])],
      ["typescript", makePreset("typescript")],
    ]);
    expect(() => validateRegistry(reg)).not.toThrow();
  });

  it("throws for reference to non-existent preset", () => {
    const reg = new Map<PresetName, Preset>([
      ["base", makePreset("base")],
      ["cdk", makePreset("cdk", ["typescript" as PresetName])],
    ]);
    expect(() => validateRegistry(reg)).toThrow(
      'Preset "cdk" requires "typescript" which does not exist',
    );
  });

  it("throws for direct circular dependency (A → B → A)", () => {
    const reg = new Map<PresetName, Preset>([
      ["base", makePreset("base")],
      ["lambda", makePreset("lambda", ["s3"])],
      ["s3", makePreset("s3", ["lambda"])],
    ]);
    expect(() => validateRegistry(reg)).toThrow("Circular dependency detected");
  });

  it("throws for self-referencing dependency", () => {
    const reg = new Map<PresetName, Preset>([
      ["base", makePreset("base")],
      ["lambda", makePreset("lambda", ["lambda"])],
    ]);
    expect(() => validateRegistry(reg)).toThrow("Circular dependency detected");
  });

  it("throws for transitive circular dependency (A → B → C → A)", () => {
    const reg = new Map<PresetName, Preset>([
      ["base", makePreset("base")],
      ["lambda", makePreset("lambda", ["sqs"])],
      ["sqs", makePreset("sqs", ["s3"])],
      ["s3", makePreset("s3", ["lambda"])],
    ]);
    expect(() => validateRegistry(reg)).toThrow("Circular dependency detected");
  });

  it("includes cycle path in error message", () => {
    const reg = new Map<PresetName, Preset>([
      ["base", makePreset("base")],
      ["lambda", makePreset("lambda", ["sqs"])],
      ["sqs", makePreset("sqs", ["lambda"])],
    ]);
    try {
      validateRegistry(reg);
      expect.unreachable("Should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("lambda");
      expect(msg).toContain("sqs");
      expect(msg).toContain("→");
    }
  });
});
