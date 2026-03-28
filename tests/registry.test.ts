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
  });

  it("includes service presets", () => {
    expect(registry.has("lambda")).toBe(true);
  });

  it("has correct preset count for M3", () => {
    // base + 2 languages + 3 agents + 1 IaC + 1 service = 8
    expect(registry.size).toBe(8);
  });
});
