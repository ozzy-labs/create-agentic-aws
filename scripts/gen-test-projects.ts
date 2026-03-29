/**
 * Generate test projects under tmp/ for manual inspection.
 *
 * Usage:
 *   npx tsx scripts/gen-test-projects.ts
 */
import { rmSync } from "node:fs";
import { resolve } from "node:path";

import { generate } from "../src/generator/index.js";
import { createRegistry } from "../src/presets/registry.js";
import type { WizardAnswers } from "../src/types.js";
import { writeFiles } from "../src/utils.js";

const registry = createRegistry();
const ROOT = resolve(import.meta.dirname, "..");
const TMP = resolve(ROOT, "tmp");

function defaults(overrides: Partial<WizardAnswers>): WizardAnswers {
  return {
    projectName: "test-project",
    agents: [],
    iac: "cdk",
    compute: [],
    ai: [],
    data: [],
    dataPipeline: [],
    integration: [],
    networking: [],
    security: [],
    observability: [],
    languages: [],
    ...overrides,
  };
}

// ─── Test project definitions ───────────────────────────────────────────────
// Each entry covers a distinct architectural pattern or feature combination.

const projects: [string, Partial<WizardAnswers>][] = [
  // ── Minimal baselines ──
  ["01-minimal-cdk", { projectName: "minimal-cdk", iac: "cdk" }],
  ["02-minimal-terraform", { projectName: "minimal-terraform", iac: "terraform" }],

  // ── Agent combinations ──
  [
    "03-all-agents",
    {
      projectName: "all-agents",
      agents: ["claude-code", "amazon-q", "copilot"],
      iac: "cdk",
    },
  ],

  // ── Serverless API (CDK vs Terraform parity) ──
  [
    "04-serverless-api-cdk",
    {
      projectName: "serverless-api-cdk",
      agents: ["claude-code"],
      iac: "cdk",
      compute: ["lambda"],
      data: ["s3", "dynamodb"],
      networking: ["api-gateway"],
      security: ["cognito"],
      observability: ["cloudwatch"],
      languages: ["typescript"],
      apiGatewayOptions: { type: "http" },
    },
  ],
  [
    "05-serverless-api-terraform",
    {
      projectName: "serverless-api-terraform",
      agents: ["claude-code"],
      iac: "terraform",
      compute: ["lambda"],
      data: ["s3", "dynamodb"],
      networking: ["api-gateway"],
      security: ["cognito"],
      observability: ["cloudwatch"],
      languages: ["typescript"],
      apiGatewayOptions: { type: "http" },
    },
  ],

  // ── Container + RDB (CDK vs Terraform parity) ──
  [
    "06-container-rdb-cdk",
    {
      projectName: "container-rdb-cdk",
      iac: "cdk",
      compute: ["ecs"],
      data: ["aurora"],
      observability: ["cloudwatch"],
      ecsOptions: { launchType: "fargate", loadBalancer: "alb" },
      auroraOptions: { capacity: "serverless-v2", engine: "postgresql" },
    },
  ],
  [
    "07-container-rdb-terraform",
    {
      projectName: "container-rdb-terraform",
      iac: "terraform",
      compute: ["ecs"],
      data: ["rds"],
      observability: ["cloudwatch"],
      languages: ["python"],
      ecsOptions: { launchType: "fargate", loadBalancer: "alb" },
      rdsOptions: { engine: "mysql" },
    },
  ],

  // ── Event-driven architecture ──
  [
    "08-event-driven",
    {
      projectName: "event-driven",
      agents: ["claude-code"],
      iac: "cdk",
      compute: ["lambda"],
      data: ["dynamodb"],
      integration: ["sqs", "sns", "eventbridge", "step-functions"],
      observability: ["cloudwatch"],
      languages: ["typescript"],
    },
  ],

  // ── Static hosting ──
  [
    "09-static-hosting",
    {
      projectName: "static-hosting",
      iac: "cdk",
      data: ["s3"],
      networking: ["cloudfront"],
    },
  ],

  // ── EKS fullstack ──
  [
    "10-eks-fullstack",
    {
      projectName: "eks-fullstack",
      agents: ["amazon-q"],
      iac: "cdk",
      compute: ["eks"],
      data: ["s3", "aurora"],
      observability: ["cloudwatch"],
      eksOptions: { mode: "managed-node-group", loadBalancer: "alb" },
      auroraOptions: { capacity: "serverless-v2", engine: "postgresql" },
    },
  ],

  // ── EC2 classic ──
  [
    "11-ec2-classic",
    {
      projectName: "ec2-classic",
      iac: "terraform",
      compute: ["ec2"],
      observability: ["cloudwatch"],
      languages: ["python"],
      ec2Options: { loadBalancer: "alb" },
    },
  ],

  // ── AI stack ──
  [
    "12-ai-stack-cdk",
    {
      projectName: "ai-stack-cdk",
      iac: "cdk",
      compute: ["lambda"],
      ai: ["bedrock", "bedrock-kb", "bedrock-agents", "opensearch"],
      languages: ["typescript"],
    },
  ],

  // ── Data pipeline ──
  [
    "13-data-pipeline",
    {
      projectName: "data-pipeline",
      iac: "cdk",
      data: ["s3"],
      dataPipeline: ["kinesis", "glue", "redshift"],
      redshiftOptions: { mode: "serverless" },
    },
  ],

  // ── Kitchen sink (CDK vs Terraform parity — maximum preset coverage) ──
  [
    "14-kitchen-sink-cdk",
    {
      projectName: "kitchen-sink-cdk",
      agents: ["claude-code", "amazon-q", "copilot"],
      iac: "cdk",
      compute: ["lambda", "ecs", "eks", "ec2"],
      ai: ["bedrock", "bedrock-kb", "bedrock-agents", "opensearch"],
      data: ["s3", "dynamodb", "aurora", "rds"],
      dataPipeline: ["kinesis", "glue", "redshift"],
      integration: ["sqs", "sns", "eventbridge", "step-functions"],
      networking: ["api-gateway", "cloudfront"],
      security: ["cognito"],
      observability: ["cloudwatch"],
      languages: ["typescript", "python"],
      ecsOptions: { launchType: "fargate", loadBalancer: "alb" },
      eksOptions: { mode: "auto-mode", loadBalancer: "alb" },
      ec2Options: { loadBalancer: "none" },
      lambdaOptions: { vpcPlacement: true },
      auroraOptions: { capacity: "serverless-v2", engine: "postgresql" },
      rdsOptions: { engine: "mysql" },
      openSearchOptions: { mode: "serverless" },
      redshiftOptions: { mode: "serverless" },
      apiGatewayOptions: { type: "http" },
    },
  ],
  [
    "15-kitchen-sink-terraform",
    {
      projectName: "kitchen-sink-terraform",
      agents: ["claude-code", "amazon-q", "copilot"],
      iac: "terraform",
      compute: ["lambda", "ecs", "eks", "ec2"],
      ai: ["bedrock", "bedrock-kb", "bedrock-agents", "opensearch"],
      data: ["s3", "dynamodb", "aurora", "rds"],
      dataPipeline: ["kinesis", "glue", "redshift"],
      integration: ["sqs", "sns", "eventbridge", "step-functions"],
      networking: ["api-gateway", "cloudfront"],
      security: ["cognito"],
      observability: ["cloudwatch"],
      languages: ["typescript", "python"],
      ecsOptions: { launchType: "fargate", loadBalancer: "alb" },
      eksOptions: { mode: "auto-mode", loadBalancer: "alb" },
      ec2Options: { loadBalancer: "none" },
      lambdaOptions: { vpcPlacement: true },
      auroraOptions: { capacity: "serverless-v2", engine: "postgresql" },
      rdsOptions: { engine: "mysql" },
      openSearchOptions: { mode: "serverless" },
      redshiftOptions: { mode: "serverless" },
      apiGatewayOptions: { type: "http" },
    },
  ],

  // ── Sub-option variants (cover options not exercised above) ──
  [
    "16-lambda-vpc",
    {
      projectName: "lambda-vpc",
      iac: "cdk",
      compute: ["lambda"],
      data: ["s3"],
      languages: ["typescript"],
      lambdaOptions: { vpcPlacement: true },
    },
  ],
  [
    "17-lambda-python-only",
    {
      projectName: "lambda-python-only",
      agents: ["copilot"],
      iac: "terraform",
      compute: ["lambda"],
      languages: ["python"],
    },
  ],
  [
    "18-ecs-nlb",
    {
      projectName: "ecs-nlb",
      iac: "cdk",
      compute: ["ecs"],
      observability: ["cloudwatch"],
      ecsOptions: { launchType: "fargate", loadBalancer: "nlb" },
    },
  ],
  [
    "19-eks-fargate",
    {
      projectName: "eks-fargate",
      iac: "terraform",
      compute: ["eks"],
      data: ["aurora"],
      observability: ["cloudwatch"],
      eksOptions: { mode: "fargate", loadBalancer: "alb" },
      auroraOptions: { capacity: "serverless-v2", engine: "postgresql" },
    },
  ],
  [
    "20-api-gateway-rest",
    {
      projectName: "api-gateway-rest",
      iac: "cdk",
      compute: ["lambda"],
      networking: ["api-gateway"],
      security: ["cognito"],
      languages: ["typescript"],
      apiGatewayOptions: { type: "rest" },
    },
  ],
  [
    "21-aurora-mysql",
    {
      projectName: "aurora-mysql",
      iac: "terraform",
      compute: ["ecs"],
      data: ["aurora"],
      ecsOptions: { launchType: "fargate", loadBalancer: "alb" },
      auroraOptions: { capacity: "provisioned", engine: "mysql" },
    },
  ],
  [
    "22-opensearch-managed",
    {
      projectName: "opensearch-managed",
      iac: "cdk",
      compute: ["lambda"],
      ai: ["bedrock", "bedrock-kb", "opensearch"],
      languages: ["typescript"],
      openSearchOptions: { mode: "managed-cluster" },
    },
  ],
  [
    "23-redshift-provisioned",
    {
      projectName: "redshift-provisioned",
      iac: "terraform",
      data: ["s3"],
      dataPipeline: ["glue", "redshift"],
      redshiftOptions: { mode: "provisioned" },
    },
  ],
  [
    "24-dual-language",
    {
      projectName: "dual-language",
      iac: "cdk",
      compute: ["lambda"],
      dataPipeline: ["glue"],
      languages: ["typescript", "python"],
    },
  ],
];

// ─── Generate ───────────────────────────────────────────────────────────────

rmSync(TMP, { recursive: true, force: true });

for (const [dir, overrides] of projects) {
  const answers = defaults(overrides);
  const result = generate(answers, registry);
  const outputDir = resolve(TMP, dir);
  writeFiles(result, outputDir);
  console.log(`✓ ${dir} (${result.files.size} files)`);
}

console.log(`\nGenerated ${projects.length} test projects in tmp/`);
