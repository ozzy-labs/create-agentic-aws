import { describe, expect, it } from "vitest";

import { createRegistry } from "../src/presets/registry.js";

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
  });

  it("has correct preset count for M5", () => {
    // base + 2 languages + 3 agents + 2 IaC + 8 services + 1 infra = 17
    expect(registry.size).toBe(17);
  });
});
