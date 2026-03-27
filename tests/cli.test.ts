import { describe, expect, it, vi } from "vitest";

import { resolveAutoLanguages } from "../src/cli.js";

// Mock @clack/prompts to prevent actual terminal interaction
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  text: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn() },
  outro: vi.fn(),
  note: vi.fn(),
}));

// Mock picocolors to return plain strings
vi.mock("picocolors", () => ({
  default: {
    bgCyan: (s: string) => s,
    black: (s: string) => s,
    dim: (s: string) => s,
    green: (s: string) => s,
  },
}));

// ---------------------------------------------------------------------------
// resolveAutoLanguages
// ---------------------------------------------------------------------------

describe("resolveAutoLanguages", () => {
  it("auto-resolves TypeScript when CDK is selected", () => {
    const result = resolveAutoLanguages("cdk");
    expect(result.has("typescript")).toBe(true);
  });

  it("does not auto-resolve TypeScript when Terraform is selected", () => {
    const result = resolveAutoLanguages("terraform");
    expect(result.has("typescript")).toBe(false);
  });

  it("returns empty set for Terraform", () => {
    const result = resolveAutoLanguages("terraform");
    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Wizard structure (import validation)
// ---------------------------------------------------------------------------

describe("cli module", () => {
  it("exports runWizard function", async () => {
    const mod = await import("../src/cli.js");
    expect(typeof mod.runWizard).toBe("function");
  });

  it("exports resolveAutoLanguages function", async () => {
    const mod = await import("../src/cli.js");
    expect(typeof mod.resolveAutoLanguages).toBe("function");
  });
});
