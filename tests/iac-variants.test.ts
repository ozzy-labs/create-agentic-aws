import { describe, expect, it } from "vitest";

import { expectAllJsonValid, expectNoLeftoverPlaceholders, generateProject } from "./helpers.js";

// ---------------------------------------------------------------------------
// A2: IaC variant tests — representative services × CDK/Terraform
// Verifies that each service generates correct IaC output for both IaC types
// ---------------------------------------------------------------------------

describe("iac variant tests", () => {
  describe("Lambda × CDK", () => {
    const result = generateProject({
      iac: "cdk",
      compute: ["lambda"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("generates CDK construct", () => {
      expect(result.hasFile("infra/lib/constructs/lambda.ts")).toBe(true);
    });

    it("does NOT generate Terraform .tf file", () => {
      expect(result.hasFile("infra/lambda.tf")).toBe(false);
    });

    it("generates CDK infra structure", () => {
      expect(result.hasFile("infra/bin/app.ts")).toBe(true);
      expect(result.hasFile("infra/lib/app-stack.ts")).toBe(true);
      expect(result.hasFile("infra/cdk.json")).toBe(true);
    });

    it("does NOT generate Terraform infra structure", () => {
      expect(result.hasFile("infra/main.tf")).toBe(false);
      expect(result.hasFile("infra/variables.tf")).toBe(false);
    });
  });

  describe("Lambda × Terraform", () => {
    const result = generateProject({
      iac: "terraform",
      compute: ["lambda"],
    });

    it("generates valid JSON files", () => {
      expectAllJsonValid(result);
    });

    it("has no leftover placeholders", () => {
      expectNoLeftoverPlaceholders(result);
    });

    it("generates Terraform .tf file", () => {
      expect(result.hasFile("infra/lambda.tf")).toBe(true);
    });

    it("does NOT generate CDK construct", () => {
      expect(result.hasFile("infra/lib/constructs/lambda.ts")).toBe(false);
    });

    it("generates Terraform infra structure", () => {
      expect(result.hasFile("infra/main.tf")).toBe(true);
      expect(result.hasFile("infra/variables.tf")).toBe(true);
      expect(result.hasFile("infra/outputs.tf")).toBe(true);
    });

    it("does NOT generate CDK infra structure", () => {
      expect(result.hasFile("infra/bin/app.ts")).toBe(false);
      expect(result.hasFile("infra/cdk.json")).toBe(false);
    });

    it("merges Lambda outputs into outputs.tf", () => {
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("lambda_function_name");
      expect(outputs).toContain("lambda_function_arn");
    });

    it("merges Lambda variables into variables.tf", () => {
      const vars = result.readText("infra/variables.tf");
      expect(vars).toContain("lambda_memory_size");
    });

    it("lambda.tf contains IAM role and function", () => {
      const tf = result.readText("infra/lambda.tf");
      expect(tf).toContain("aws_lambda_function");
      expect(tf).toContain("aws_iam_role");
    });
  });

  describe("DynamoDB × CDK", () => {
    const result = generateProject({
      iac: "cdk",
      data: ["dynamodb"],
    });

    it("generates CDK construct", () => {
      expect(result.hasFile("infra/lib/constructs/dynamodb.ts")).toBe(true);
    });

    it("does NOT generate Terraform .tf file", () => {
      expect(result.hasFile("infra/dynamodb.tf")).toBe(false);
    });

    it("app-stack.ts contains DynamoDB construct", () => {
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("DynamoDbTable");
    });
  });

  describe("DynamoDB × Terraform", () => {
    const result = generateProject({
      iac: "terraform",
      data: ["dynamodb"],
    });

    it("generates Terraform .tf file", () => {
      expect(result.hasFile("infra/dynamodb.tf")).toBe(true);
    });

    it("does NOT generate CDK construct", () => {
      expect(result.hasFile("infra/lib/constructs/dynamodb.ts")).toBe(false);
    });

    it("dynamodb.tf contains table resource", () => {
      const tf = result.readText("infra/dynamodb.tf");
      expect(tf).toContain("aws_dynamodb_table");
      expect(tf).toContain("PAY_PER_REQUEST");
    });

    it("merges DynamoDB outputs into outputs.tf", () => {
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("dynamodb_table_name");
    });
  });

  describe("S3 × Terraform", () => {
    const result = generateProject({
      iac: "terraform",
      data: ["s3"],
    });

    it("generates s3.tf with bucket and security config", () => {
      expect(result.hasFile("infra/s3.tf")).toBe(true);
      const tf = result.readText("infra/s3.tf");
      expect(tf).toContain("aws_s3_bucket");
      expect(tf).toContain("aws_s3_bucket_versioning");
      expect(tf).toContain("aws_s3_bucket_public_access_block");
    });
  });

  describe("API Gateway × Terraform", () => {
    const result = generateProject({
      iac: "terraform",
      networking: ["api-gateway"],
    });

    it("generates api-gateway.tf with HTTP API", () => {
      expect(result.hasFile("infra/api-gateway.tf")).toBe(true);
      const tf = result.readText("infra/api-gateway.tf");
      expect(tf).toContain("aws_apigatewayv2_api");
      expect(tf).toContain("cors_configuration");
    });
  });

  describe("Multiple services × Terraform", () => {
    const result = generateProject({
      iac: "terraform",
      compute: ["lambda"],
      data: ["s3", "dynamodb"],
      integration: ["sqs"],
    });

    it("generates all service .tf files", () => {
      expect(result.hasFile("infra/lambda.tf")).toBe(true);
      expect(result.hasFile("infra/s3.tf")).toBe(true);
      expect(result.hasFile("infra/dynamodb.tf")).toBe(true);
      expect(result.hasFile("infra/sqs.tf")).toBe(true);
    });

    it("merges all outputs into outputs.tf", () => {
      const outputs = result.readText("infra/outputs.tf");
      expect(outputs).toContain("lambda_function_name");
      expect(outputs).toContain("s3_bucket_name");
      expect(outputs).toContain("dynamodb_table_name");
      expect(outputs).toContain("sqs_queue_url");
    });

    it("application boilerplate is shared between IaC types", () => {
      // Lambda handler and DynamoDB DAL are IaC-independent
      expect(result.hasFile("lambda/handlers/index.ts")).toBe(true);
      expect(result.hasFile("lib/dynamodb/client.ts")).toBe(true);
      expect(result.hasFile("lib/sqs/consumer.ts")).toBe(true);
    });
  });
});
