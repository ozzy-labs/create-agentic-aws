import { describe, expect, it } from "vitest";

import { expectAllJsonValid, expectNoLeftoverPlaceholders, generateProject } from "./helpers.js";

// ---------------------------------------------------------------------------
// Pairwise tests: important service combinations (M3 scope)
// ---------------------------------------------------------------------------

describe("pairwise tests", () => {
  describe("Lambda + DynamoDB + API Gateway (serverless API)", () => {
    const result = generateProject({
      iac: "cdk",
      compute: ["lambda"],
      data: ["dynamodb"],
      networking: ["api-gateway"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("generates all three construct files", () => {
      expect(result.hasFile("infra/lib/constructs/lambda.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/dynamodb.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/api-gateway.ts")).toBe(true);
    });

    it("app-stack.ts contains all three constructs", () => {
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("LambdaFunction");
      expect(appStack).toContain("DynamoDbTable");
      expect(appStack).toContain("ApiGateway");
    });

    it("generates Lambda handler and DynamoDB DAL", () => {
      expect(result.hasFile("lambda/handlers/index.ts")).toBe(true);
      expect(result.hasFile("lib/dynamodb/client.ts")).toBe(true);
      expect(result.hasFile("lib/dynamodb/repository.ts")).toBe(true);
    });

    it("merges dependencies from all three services", () => {
      const pkg = result.readJson<{ devDependencies: Record<string, string> }>("package.json");
      expect(pkg.devDependencies["@types/aws-lambda"]).toBeDefined();
      expect(pkg.devDependencies["@aws-sdk/client-dynamodb"]).toBeDefined();
      expect(pkg.devDependencies["@aws-lambda-powertools/logger"]).toBeDefined();
    });

    it("infra/package.json has esbuild for Lambda bundling", () => {
      const pkg = result.readJson<{ devDependencies: Record<string, string> }>(
        "infra/package.json",
      );
      expect(pkg.devDependencies.esbuild).toBeDefined();
    });
  });

  describe("Lambda + SQS (async processing)", () => {
    const result = generateProject({
      iac: "cdk",
      compute: ["lambda"],
      integration: ["sqs"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("generates both construct files", () => {
      expect(result.hasFile("infra/lib/constructs/lambda.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/sqs.ts")).toBe(true);
    });

    it("app-stack.ts contains both constructs", () => {
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("LambdaFunction");
      expect(appStack).toContain("SqsQueue");
    });

    it("generates Lambda handler and SQS consumer", () => {
      expect(result.hasFile("lambda/handlers/index.ts")).toBe(true);
      expect(result.hasFile("lib/sqs/consumer.ts")).toBe(true);
    });

    it("@types/aws-lambda is deduplicated across Lambda and SQS", () => {
      const pkg = result.readJson<{ devDependencies: Record<string, string> }>("package.json");
      expect(pkg.devDependencies["@types/aws-lambda"]).toBeDefined();
    });
  });

  describe("S3 + CloudFront (static hosting)", () => {
    const result = generateProject({
      iac: "cdk",
      data: ["s3"],
      networking: ["cloudfront"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("generates both construct files", () => {
      expect(result.hasFile("infra/lib/constructs/s3.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/cloudfront.ts")).toBe(true);
    });

    it("app-stack.ts contains both constructs", () => {
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("S3Bucket");
      expect(appStack).toContain("CloudFrontDistribution");
    });
  });

  describe("API Gateway + Cognito (authenticated API)", () => {
    const result = generateProject({
      iac: "cdk",
      networking: ["api-gateway"],
      security: ["cognito"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("generates both construct files", () => {
      expect(result.hasFile("infra/lib/constructs/api-gateway.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/cognito.ts")).toBe(true);
    });

    it("app-stack.ts contains both constructs", () => {
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("ApiGateway");
      expect(appStack).toContain("CognitoAuth");
    });
  });

  // ---------------------------------------------------------------------------
  // M5: Container/Server + RDB combinations
  // ---------------------------------------------------------------------------

  describe("ECS + Aurora + VPC (container + RDB)", () => {
    const result = generateProject({
      iac: "cdk",
      compute: ["ecs"],
      data: ["aurora"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("generates all three construct files", () => {
      expect(result.hasFile("infra/lib/constructs/ecs.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/aurora.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/vpc.ts")).toBe(true);
    });

    it("auto-resolves VPC for both ECS and Aurora", () => {
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("EcsService");
      expect(appStack).toContain("AuroraCluster");
      expect(appStack).toContain("Vpc");
    });

    it("generates ECS app files (Dockerfile)", () => {
      expect(result.hasFile("ecs/Dockerfile")).toBe(true);
      expect(result.hasFile("ecs/src/index.ts")).toBe(true);
    });
  });

  describe("Lambda + ECS (mixed compute)", () => {
    const result = generateProject({
      iac: "cdk",
      compute: ["lambda", "ecs"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("generates both compute construct files", () => {
      expect(result.hasFile("infra/lib/constructs/lambda.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/ecs.ts")).toBe(true);
    });

    it("auto-resolves VPC for ECS", () => {
      expect(result.hasFile("infra/lib/constructs/vpc.ts")).toBe(true);
    });

    it("generates both app directories", () => {
      expect(result.hasFile("lambda/handlers/index.ts")).toBe(true);
      expect(result.hasFile("ecs/Dockerfile")).toBe(true);
    });

    it("app-stack.ts contains both compute services", () => {
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("LambdaFunction");
      expect(appStack).toContain("EcsService");
    });
  });

  describe("ECS + Aurora + VPC (Terraform)", () => {
    const result = generateProject({
      iac: "terraform",
      compute: ["ecs"],
      data: ["aurora"],
    });

    it("generates all service .tf files", () => {
      expect(result.hasFile("infra/ecs.tf")).toBe(true);
      expect(result.hasFile("infra/aurora.tf")).toBe(true);
      expect(result.hasFile("infra/vpc.tf")).toBe(true);
    });

    it("merges outputs from all services", () => {
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("ecs_cluster_name");
      expect(outputs).toContain("aurora_cluster_endpoint");
      expect(outputs).toContain("vpc_id");
    });
  });

  // ---------------------------------------------------------------------------
  // M6: Event-driven combinations
  // ---------------------------------------------------------------------------

  describe("SQS + SNS + EventBridge (event-driven pipeline)", () => {
    const result = generateProject({
      iac: "cdk",
      integration: ["sqs", "sns", "eventbridge"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("generates all three construct files", () => {
      expect(result.hasFile("infra/lib/constructs/sqs.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/sns.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/eventbridge.ts")).toBe(true);
    });

    it("generates EventBridge schema and SQS consumer", () => {
      expect(result.hasFile("lib/eventbridge/events.ts")).toBe(true);
      expect(result.hasFile("lib/eventbridge/publisher.ts")).toBe(true);
      expect(result.hasFile("lib/sqs/consumer.ts")).toBe(true);
    });
  });

  describe("Lambda + Step Functions (orchestrated workflow)", () => {
    const result = generateProject({
      iac: "cdk",
      compute: ["lambda"],
      integration: ["step-functions"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("generates both construct files", () => {
      expect(result.hasFile("infra/lib/constructs/lambda.ts")).toBe(true);
      expect(result.hasFile("infra/lib/constructs/step-functions.ts")).toBe(true);
    });

    it("generates Lambda handler and workflow definition", () => {
      expect(result.hasFile("lambda/handlers/index.ts")).toBe(true);
      expect(result.hasFile("lib/step-functions/definition.ts")).toBe(true);
    });

    it("app-stack.ts contains both constructs", () => {
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("LambdaFunction");
      expect(appStack).toContain("StepFunctionsWorkflow");
    });
  });
});
