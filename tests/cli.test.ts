import * as p from "@clack/prompts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { notifyVpcAutoResolution, resolveAutoLanguages, runWizard } from "../src/cli.js";

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

// ---------------------------------------------------------------------------
// runWizard
// ---------------------------------------------------------------------------

describe("runWizard", () => {
  const mockText = vi.mocked(p.text);
  const mockSelect = vi.mocked(p.select);
  const mockMultiselect = vi.mocked(p.multiselect);

  function setupMinimalWizard(overrides: { projectName?: string; iac?: string } = {}): void {
    const { projectName = "my-app", iac = "cdk" } = overrides;
    // p.text: project name
    mockText.mockResolvedValueOnce(projectName);
    // p.multiselect: agents
    mockMultiselect.mockResolvedValueOnce([]);
    // p.select: iac
    mockSelect.mockResolvedValueOnce(iac);
    // p.multiselect: compute, ai, data, dataPipeline, integration, networking, security, observability
    mockMultiselect.mockResolvedValueOnce([]); // compute
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce([]); // data
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    // CDK auto-resolves TypeScript but Python remains — languages prompt still shown
    mockMultiselect.mockResolvedValueOnce([]); // languages
  }

  beforeEach(() => {
    mockText.mockReset();
    mockSelect.mockReset();
    mockMultiselect.mockReset();
    vi.mocked(p.log.info).mockReset();
  });

  it("returns minimal answers with CDK", async () => {
    setupMinimalWizard({ iac: "cdk" });
    const answers = await runWizard();
    expect(answers.projectName).toBe("my-app");
    expect(answers.iac).toBe("cdk");
    expect(answers.languages).toContain("typescript");
    expect(answers.agents).toEqual([]);
    expect(answers.compute).toEqual([]);
  });

  it("returns minimal answers with Terraform", async () => {
    setupMinimalWizard({ iac: "terraform" });
    const answers = await runWizard();
    expect(answers.projectName).toBe("my-app");
    expect(answers.iac).toBe("terraform");
    expect(answers.languages).toEqual([]);
  });

  it("uses defaultName as initial value for project name", async () => {
    setupMinimalWizard();
    await runWizard("custom-name");
    expect(mockText).toHaveBeenCalledWith(expect.objectContaining({ initialValue: "custom-name" }));
  });

  it("collects selected agents", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce(["claude-code", "copilot"]); // agents
    mockSelect.mockResolvedValueOnce("cdk"); // iac
    mockMultiselect.mockResolvedValueOnce([]); // compute
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce([]); // data
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce([]); // languages
    const answers = await runWizard();
    expect(answers.agents).toEqual(["claude-code", "copilot"]);
  });

  it("asks Lambda sub-options when Lambda is selected", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce([]); // agents
    mockSelect.mockResolvedValueOnce("cdk"); // iac
    mockMultiselect.mockResolvedValueOnce(["lambda"]); // compute
    mockSelect.mockResolvedValueOnce(true); // lambda vpc placement
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce([]); // data
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce([]); // languages
    const answers = await runWizard();
    expect(answers.lambdaOptions?.vpcPlacement).toBe(true);
  });

  it("asks ECS sub-options when ECS is selected", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce([]); // agents
    mockSelect.mockResolvedValueOnce("cdk"); // iac
    mockMultiselect.mockResolvedValueOnce(["ecs"]); // compute
    mockSelect.mockResolvedValueOnce("fargate"); // ecs launch type
    mockSelect.mockResolvedValueOnce("alb"); // ecs load balancer
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce([]); // data
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce([]); // languages
    const answers = await runWizard();
    expect(answers.ecsOptions?.launchType).toBe("fargate");
    expect(answers.ecsOptions?.loadBalancer).toBe("alb");
  });

  it("asks EKS sub-options when EKS is selected", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce([]); // agents
    mockSelect.mockResolvedValueOnce("cdk"); // iac
    mockMultiselect.mockResolvedValueOnce(["eks"]); // compute
    mockSelect.mockResolvedValueOnce("auto-mode"); // eks mode
    mockSelect.mockResolvedValueOnce("nlb"); // eks load balancer
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce([]); // data
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce([]); // languages
    const answers = await runWizard();
    expect(answers.eksOptions?.mode).toBe("auto-mode");
    expect(answers.eksOptions?.loadBalancer).toBe("nlb");
  });

  it("asks Aurora sub-options when Aurora is selected", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce([]); // agents
    mockSelect.mockResolvedValueOnce("cdk"); // iac
    mockMultiselect.mockResolvedValueOnce([]); // compute
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce(["aurora"]); // data
    mockSelect.mockResolvedValueOnce("serverless-v2"); // aurora capacity
    mockSelect.mockResolvedValueOnce("postgresql"); // aurora engine
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce([]); // languages
    const answers = await runWizard();
    expect(answers.auroraOptions?.capacity).toBe("serverless-v2");
    expect(answers.auroraOptions?.engine).toBe("postgresql");
  });

  it("asks RDS sub-options when RDS is selected", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce([]); // agents
    mockSelect.mockResolvedValueOnce("terraform"); // iac
    mockMultiselect.mockResolvedValueOnce([]); // compute
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce(["rds"]); // data
    mockSelect.mockResolvedValueOnce("mysql"); // rds engine
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce([]); // languages
    const answers = await runWizard();
    expect(answers.rdsOptions?.engine).toBe("mysql");
  });

  it("asks OpenSearch sub-options when OpenSearch is selected", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce([]); // agents
    mockSelect.mockResolvedValueOnce("cdk"); // iac
    mockMultiselect.mockResolvedValueOnce([]); // compute
    mockMultiselect.mockResolvedValueOnce(["opensearch"]); // ai
    mockSelect.mockResolvedValueOnce("managed-cluster"); // opensearch mode
    mockMultiselect.mockResolvedValueOnce([]); // data
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce([]); // languages
    const answers = await runWizard();
    expect(answers.openSearchOptions?.mode).toBe("managed-cluster");
  });

  it("asks Redshift sub-options when Redshift is selected", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce([]); // agents
    mockSelect.mockResolvedValueOnce("cdk"); // iac
    mockMultiselect.mockResolvedValueOnce([]); // compute
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce([]); // data
    mockMultiselect.mockResolvedValueOnce(["redshift"]); // dataPipeline
    mockSelect.mockResolvedValueOnce("provisioned"); // redshift mode
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce([]); // languages
    const answers = await runWizard();
    expect(answers.redshiftOptions?.mode).toBe("provisioned");
  });

  it("asks API Gateway sub-options when API Gateway is selected", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce([]); // agents
    mockSelect.mockResolvedValueOnce("cdk"); // iac
    mockMultiselect.mockResolvedValueOnce([]); // compute
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce([]); // data
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce(["api-gateway"]); // networking
    mockSelect.mockResolvedValueOnce("http"); // api gateway type
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce([]); // languages
    const answers = await runWizard();
    expect(answers.apiGatewayOptions?.type).toBe("http");
  });

  it("exits gracefully on cancel", async () => {
    vi.mocked(p.isCancel).mockReturnValueOnce(true);
    mockText.mockResolvedValueOnce(Symbol("cancel"));
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    await expect(runWizard()).rejects.toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  it("notifies VPC auto-resolution for compute triggers", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce([]); // agents
    mockSelect.mockResolvedValueOnce("cdk"); // iac
    mockMultiselect.mockResolvedValueOnce(["ecs"]); // compute — triggers VPC
    mockSelect.mockResolvedValueOnce("fargate"); // ecs launch type
    mockSelect.mockResolvedValueOnce("none"); // ecs load balancer
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce([]); // data
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce([]); // languages
    await runWizard();
    // VPC auto-resolution + TypeScript auto-resolution = at least 2 log calls
    expect(vi.mocked(p.log.info).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("handles multiple compute services with sub-options", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce([]); // agents
    mockSelect.mockResolvedValueOnce("cdk"); // iac
    mockMultiselect.mockResolvedValueOnce(["lambda", "ecs"]); // compute
    mockSelect.mockResolvedValueOnce(false); // lambda vpc placement
    mockSelect.mockResolvedValueOnce("fargate"); // ecs launch type
    mockSelect.mockResolvedValueOnce("alb"); // ecs load balancer
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce([]); // data
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce([]); // languages
    const answers = await runWizard();
    expect(answers.lambdaOptions?.vpcPlacement).toBe(false);
    expect(answers.ecsOptions?.launchType).toBe("fargate");
  });

  it("asks EC2 sub-options when EC2 is selected", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce([]); // agents
    mockSelect.mockResolvedValueOnce("cdk"); // iac
    mockMultiselect.mockResolvedValueOnce(["ec2"]); // compute
    mockSelect.mockResolvedValueOnce("none"); // ec2 load balancer
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce([]); // data
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce([]); // languages
    const answers = await runWizard();
    expect(answers.ec2Options?.loadBalancer).toBe("none");
  });

  it("allows manual language selection with Terraform", async () => {
    mockText.mockResolvedValueOnce("my-app");
    mockMultiselect.mockResolvedValueOnce([]); // agents
    mockSelect.mockResolvedValueOnce("terraform"); // iac
    mockMultiselect.mockResolvedValueOnce([]); // compute
    mockMultiselect.mockResolvedValueOnce([]); // ai
    mockMultiselect.mockResolvedValueOnce([]); // data
    mockMultiselect.mockResolvedValueOnce([]); // dataPipeline
    mockMultiselect.mockResolvedValueOnce([]); // integration
    mockMultiselect.mockResolvedValueOnce([]); // networking
    mockMultiselect.mockResolvedValueOnce([]); // security
    mockMultiselect.mockResolvedValueOnce([]); // observability
    mockMultiselect.mockResolvedValueOnce(["python"]); // languages
    const answers = await runWizard();
    expect(answers.languages).toEqual(["python"]);
  });

  it("does not include undefined sub-options when service not selected", async () => {
    setupMinimalWizard();
    const answers = await runWizard();
    expect(answers.lambdaOptions).toBeUndefined();
    expect(answers.ecsOptions).toBeUndefined();
    expect(answers.eksOptions).toBeUndefined();
    expect(answers.ec2Options).toBeUndefined();
    expect(answers.auroraOptions).toBeUndefined();
    expect(answers.rdsOptions).toBeUndefined();
    expect(answers.openSearchOptions).toBeUndefined();
    expect(answers.redshiftOptions).toBeUndefined();
    expect(answers.apiGatewayOptions).toBeUndefined();
  });
});
