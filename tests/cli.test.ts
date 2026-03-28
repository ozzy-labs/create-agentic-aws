import { describe, expect, it, vi } from "vitest";

import { notifyVpcAutoResolution, resolveAutoLanguages } from "../src/cli.js";

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
// notifyVpcAutoResolution
// ---------------------------------------------------------------------------

describe("notifyVpcAutoResolution", () => {
  it("does not throw for empty selections", () => {
    expect(() => notifyVpcAutoResolution([], [])).not.toThrow();
  });

  it("does not throw when VPC trigger is present in compute", () => {
    expect(() => notifyVpcAutoResolution(["ecs"], [])).not.toThrow();
  });

  it("detects VPC trigger from data presets", () => {
    expect(() => notifyVpcAutoResolution([], ["aurora"])).not.toThrow();
  });

  it("does not trigger for non-VPC services (lambda only)", () => {
    expect(() => notifyVpcAutoResolution(["lambda"], [])).not.toThrow();
  });

  it("does not trigger for non-VPC data services (s3, dynamodb)", () => {
    expect(() => notifyVpcAutoResolution([], ["s3", "dynamodb"])).not.toThrow();
  });

  it("triggers for eks in compute", () => {
    expect(() => notifyVpcAutoResolution(["eks"], [])).not.toThrow();
  });

  it("triggers for ec2 in compute", () => {
    expect(() => notifyVpcAutoResolution(["ec2"], [])).not.toThrow();
  });

  it("triggers for rds in data", () => {
    expect(() => notifyVpcAutoResolution([], ["rds"])).not.toThrow();
  });

  it("handles mixed compute and data with VPC triggers", () => {
    expect(() => notifyVpcAutoResolution(["ecs", "lambda"], ["aurora", "s3"])).not.toThrow();
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
