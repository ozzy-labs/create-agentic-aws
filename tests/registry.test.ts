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

  it("has correct preset count for M2", () => {
    // base + 2 languages + 3 agents = 6
    expect(registry.size).toBe(6);
  });
});
