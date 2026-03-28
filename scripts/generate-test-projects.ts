/**
 * Generate test projects under tmp/ covering major preset patterns.
 *
 * Usage: npx tsx scripts/generate-test-projects.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { generate } from "../src/generator/index.js";
import { createRegistry } from "../src/presets/registry.js";
import type { GenerateResult, WizardAnswers } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnswers(overrides: Partial<WizardAnswers> = {}): WizardAnswers {
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

function writeToDisk(result: GenerateResult, outDir: string): void {
  for (const [relPath, content] of result.files) {
    const absPath = join(outDir, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, content, "utf-8");
  }
}

// ---------------------------------------------------------------------------
// Test project definitions
// ---------------------------------------------------------------------------

interface TestProject {
  readonly name: string;
  readonly description: string;
  readonly overrides: Partial<WizardAnswers>;
}

const projects: TestProject[] = [
  // ── 1. Minimal (base only) ──────────────────────────────────────────
  {
    name: "01-minimal-cdk",
    description: "Base + CDK only (minimal)",
    overrides: { projectName: "minimal-cdk" },
  },
  {
    name: "02-minimal-terraform",
    description: "Base + Terraform only (minimal)",
    overrides: { projectName: "minimal-terraform", iac: "terraform" },
  },

  // ── 2. Agent variations ─────────────────────────────────────────────
  {
    name: "03-all-agents",
    description: "All 3 AI agents (Claude Code, Amazon Q, Copilot)",
    overrides: {
      projectName: "all-agents",
      agents: ["claude-code", "amazon-q", "copilot"],
    },
  },

  // ── 3. Serverless API (CDK) ─────────────────────────────────────────
  {
    name: "04-serverless-api-cdk",
    description: "Lambda + DynamoDB + API Gateway + Cognito + CloudWatch (CDK)",
    overrides: {
      projectName: "serverless-api-cdk",
      agents: ["claude-code"],
      compute: ["lambda"],
      lambdaOptions: { vpcPlacement: false },
      data: ["dynamodb"],
      networking: ["api-gateway"],
      apiGatewayOptions: { type: "rest" },
      security: ["cognito"],
      observability: ["cloudwatch"],
    },
  },

  // ── 4. Serverless API (Terraform) ───────────────────────────────────
  {
    name: "05-serverless-api-terraform",
    description: "Lambda + DynamoDB + API Gateway + Cognito + CloudWatch (Terraform)",
    overrides: {
      projectName: "serverless-api-terraform",
      iac: "terraform",
      agents: ["claude-code"],
      compute: ["lambda"],
      lambdaOptions: { vpcPlacement: false },
      data: ["dynamodb"],
      networking: ["api-gateway"],
      apiGatewayOptions: { type: "http" },
      security: ["cognito"],
      observability: ["cloudwatch"],
      languages: ["typescript"],
    },
  },

  // ── 5. Container + RDB (CDK) ────────────────────────────────────────
  {
    name: "06-container-rdb-cdk",
    description: "ECS Fargate + Aurora PostgreSQL Serverless v2 + VPC (CDK)",
    overrides: {
      projectName: "container-rdb-cdk",
      agents: ["claude-code"],
      compute: ["ecs"],
      ecsOptions: { launchType: "fargate", loadBalancer: "alb" },
      data: ["aurora"],
      auroraOptions: { capacity: "serverless-v2", engine: "postgresql" },
      observability: ["cloudwatch"],
    },
  },

  // ── 6. Container + RDB (Terraform) ─────────────────────────────────
  {
    name: "07-container-rdb-terraform",
    description: "ECS Fargate + RDS MySQL + VPC (Terraform)",
    overrides: {
      projectName: "container-rdb-terraform",
      iac: "terraform",
      compute: ["ecs"],
      ecsOptions: { launchType: "fargate", loadBalancer: "alb" },
      data: ["rds"],
      rdsOptions: { engine: "mysql" },
      observability: ["cloudwatch"],
      languages: ["python"],
    },
  },

  // ── 7. Event-driven architecture ────────────────────────────────────
  {
    name: "08-event-driven",
    description: "Lambda + SQS + SNS + EventBridge + Step Functions (CDK)",
    overrides: {
      projectName: "event-driven",
      agents: ["claude-code"],
      compute: ["lambda"],
      lambdaOptions: { vpcPlacement: false },
      integration: ["sqs", "sns", "eventbridge", "step-functions"],
      observability: ["cloudwatch"],
    },
  },

  // ── 8. Static hosting ───────────────────────────────────────────────
  {
    name: "09-static-hosting",
    description: "S3 + CloudFront (CDK)",
    overrides: {
      projectName: "static-hosting",
      data: ["s3"],
      networking: ["cloudfront"],
    },
  },

  // ── 9. EKS + Full stack ─────────────────────────────────────────────
  {
    name: "10-eks-fullstack",
    description: "EKS auto-mode + Aurora MySQL + S3 + CloudWatch (CDK)",
    overrides: {
      projectName: "eks-fullstack",
      agents: ["amazon-q"],
      compute: ["eks"],
      eksOptions: { mode: "auto-mode", loadBalancer: "alb" },
      data: ["aurora", "s3"],
      auroraOptions: { capacity: "provisioned", engine: "mysql" },
      observability: ["cloudwatch"],
    },
  },

  // ── 10. EC2 classic ─────────────────────────────────────────────────
  {
    name: "11-ec2-classic",
    description: "EC2 + RDS PostgreSQL + CloudWatch (Terraform)",
    overrides: {
      projectName: "ec2-classic",
      iac: "terraform",
      compute: ["ec2"],
      ec2Options: { loadBalancer: "nlb" },
      data: ["rds"],
      rdsOptions: { engine: "postgresql" },
      observability: ["cloudwatch"],
      languages: ["python"],
    },
  },

  // ── 11. Mixed compute ──────────────────────────────────────────────
  {
    name: "12-mixed-compute",
    description: "Lambda + ECS + Step Functions + DynamoDB (CDK)",
    overrides: {
      projectName: "mixed-compute",
      compute: ["lambda", "ecs"],
      lambdaOptions: { vpcPlacement: true },
      ecsOptions: { launchType: "fargate", loadBalancer: "none" },
      data: ["dynamodb"],
      integration: ["step-functions"],
      observability: ["cloudwatch"],
    },
  },

  // ── 12. AI stack (CDK) ───────────────────────────────────────────────
  {
    name: "13-ai-stack-cdk",
    description: "Bedrock + Bedrock KB + Bedrock Agents + OpenSearch Serverless (CDK)",
    overrides: {
      projectName: "ai-stack-cdk",
      agents: ["claude-code"],
      ai: ["bedrock", "bedrock-kb", "bedrock-agents", "opensearch"],
      openSearchOptions: { mode: "serverless" },
    },
  },

  // ── 13. AI + managed services (Terraform) ──────────────────────────
  {
    name: "14-ai-managed-terraform",
    description: "Bedrock Agents + OpenSearch Managed Cluster (Terraform)",
    overrides: {
      projectName: "ai-managed-terraform",
      iac: "terraform",
      ai: ["bedrock-agents", "opensearch"],
      openSearchOptions: { mode: "managed-cluster" },
    },
  },

  // ── 14. Data pipeline (CDK) ─────────────────────────────────────────
  {
    name: "15-data-pipeline-cdk",
    description: "Kinesis + Glue + Redshift Serverless + S3 (CDK)",
    overrides: {
      projectName: "data-pipeline-cdk",
      data: ["s3"],
      dataPipeline: ["kinesis", "glue", "redshift"],
      redshiftOptions: { mode: "serverless" },
      languages: ["python"],
    },
  },

  // ── 15. Data warehouse (Terraform) ──────────────────────────────────
  {
    name: "16-data-warehouse-terraform",
    description: "Redshift Provisioned + Glue + S3 (Terraform)",
    overrides: {
      projectName: "data-warehouse-terraform",
      iac: "terraform",
      data: ["s3"],
      dataPipeline: ["glue", "redshift"],
      redshiftOptions: { mode: "provisioned" },
      languages: ["python"],
    },
  },

  // ── 16. Kitchen sink (CDK) ──────────────────────────────────────────
  {
    name: "17-kitchen-sink-cdk",
    description: "All agents + all services + CDK (maximum combination)",
    overrides: {
      projectName: "kitchen-sink-cdk",
      agents: ["claude-code", "amazon-q", "copilot"],
      compute: ["lambda", "ecs", "eks", "ec2"],
      lambdaOptions: { vpcPlacement: true },
      ecsOptions: { launchType: "managed-instances", loadBalancer: "alb" },
      eksOptions: { mode: "managed-node-group", loadBalancer: "nlb" },
      ec2Options: { loadBalancer: "alb" },
      ai: ["bedrock", "bedrock-kb", "bedrock-agents", "opensearch"],
      openSearchOptions: { mode: "serverless" },
      data: ["s3", "dynamodb", "aurora", "rds"],
      auroraOptions: { capacity: "serverless-v2", engine: "postgresql" },
      rdsOptions: { engine: "mysql" },
      dataPipeline: ["kinesis", "glue", "redshift"],
      redshiftOptions: { mode: "serverless" },
      integration: ["sqs", "sns", "eventbridge", "step-functions"],
      networking: ["api-gateway", "cloudfront"],
      apiGatewayOptions: { type: "rest" },
      security: ["cognito"],
      observability: ["cloudwatch"],
      languages: ["python"],
    },
  },

  // ── 17. Kitchen sink (Terraform) ────────────────────────────────────
  {
    name: "18-kitchen-sink-terraform",
    description: "All agents + all services + Terraform (maximum combination)",
    overrides: {
      projectName: "kitchen-sink-terraform",
      iac: "terraform",
      agents: ["claude-code", "amazon-q", "copilot"],
      compute: ["lambda", "ecs", "eks", "ec2"],
      lambdaOptions: { vpcPlacement: true },
      ecsOptions: { launchType: "ec2", loadBalancer: "nlb" },
      eksOptions: { mode: "fargate", loadBalancer: "alb" },
      ec2Options: { loadBalancer: "none" },
      ai: ["bedrock", "bedrock-kb", "bedrock-agents", "opensearch"],
      openSearchOptions: { mode: "managed-cluster" },
      data: ["s3", "dynamodb", "aurora", "rds"],
      auroraOptions: { capacity: "provisioned", engine: "mysql" },
      rdsOptions: { engine: "postgresql" },
      dataPipeline: ["kinesis", "glue", "redshift"],
      redshiftOptions: { mode: "provisioned" },
      integration: ["sqs", "sns", "eventbridge", "step-functions"],
      networking: ["api-gateway", "cloudfront"],
      apiGatewayOptions: { type: "http" },
      security: ["cognito"],
      observability: ["cloudwatch"],
      languages: ["typescript", "python"],
    },
  },

  // ── 18. Lambda in VPC ───────────────────────────────────────────────
  {
    name: "19-lambda-vpc",
    description: "Lambda with VPC placement + S3 (CDK)",
    overrides: {
      projectName: "lambda-vpc",
      compute: ["lambda"],
      lambdaOptions: { vpcPlacement: true },
      data: ["s3"],
    },
  },

  // ── 19. Dual language ───────────────────────────────────────────────
  {
    name: "20-dual-language",
    description: "TypeScript + Python with Lambda (CDK)",
    overrides: {
      projectName: "dual-language",
      compute: ["lambda"],
      lambdaOptions: { vpcPlacement: false },
      languages: ["typescript", "python"],
    },
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const registry = createRegistry();
// biome-ignore lint/style/noNonNullAssertion: dirname is always defined for file modules
const tmpDir = join(import.meta.dirname!, "..", "tmp");

console.log(`Generating ${projects.length} test projects under tmp/\n`);

for (const project of projects) {
  const answers = makeAnswers(project.overrides);
  const result = generate(answers, registry);
  const outDir = join(tmpDir, project.name);
  writeToDisk(result, outDir);
  console.log(`  ✓ ${project.name} (${result.files.size} files) — ${project.description}`);
}

console.log(`\nDone! ${projects.length} projects generated.`);
