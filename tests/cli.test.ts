import * as p from "@clack/prompts";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  const logInfo = vi.mocked(p.log.info);

  beforeEach(() => {
    logInfo.mockClear();
  });

  it("does not notify for empty selections", () => {
    notifyVpcAutoResolution([], []);
    expect(logInfo).not.toHaveBeenCalled();
  });

  it("notifies when VPC trigger is present in compute (ecs)", () => {
    notifyVpcAutoResolution(["ecs"], []);
    expect(logInfo).toHaveBeenCalledOnce();
  });

  it("notifies when VPC trigger is present in data (aurora)", () => {
    notifyVpcAutoResolution([], ["aurora"]);
    expect(logInfo).toHaveBeenCalledOnce();
  });

  it("does not notify for non-VPC compute services (lambda only)", () => {
    notifyVpcAutoResolution(["lambda"], []);
    expect(logInfo).not.toHaveBeenCalled();
  });

  it("does not notify for non-VPC data services (s3, dynamodb)", () => {
    notifyVpcAutoResolution([], ["s3", "dynamodb"]);
    expect(logInfo).not.toHaveBeenCalled();
  });

  it("notifies for eks in compute", () => {
    notifyVpcAutoResolution(["eks"], []);
    expect(logInfo).toHaveBeenCalledOnce();
  });

  it("notifies for ec2 in compute", () => {
    notifyVpcAutoResolution(["ec2"], []);
    expect(logInfo).toHaveBeenCalledOnce();
  });

  it("notifies for rds in data", () => {
    notifyVpcAutoResolution([], ["rds"]);
    expect(logInfo).toHaveBeenCalledOnce();
  });

  it("notifies only once for mixed compute and data with VPC triggers", () => {
    notifyVpcAutoResolution(["ecs", "lambda"], ["aurora", "s3"]);
    expect(logInfo).toHaveBeenCalledOnce();
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
