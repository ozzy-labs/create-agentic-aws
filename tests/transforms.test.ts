import { describe, expect, it } from "vitest";
import { generateProject } from "./helpers.js";

describe("transforms", () => {
  describe("applyLambdaVpcPlacement", () => {
    it("CDK: adds vpc parameter to Lambda construct when vpcPlacement is true", () => {
      const result = generateProject({
        compute: ["lambda"],
        lambdaOptions: { vpcPlacement: true },
      });
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("vpc: vpc.vpc");
    });

    it("CDK: Lambda construct has no vpc when vpcPlacement is false", () => {
      const result = generateProject({
        compute: ["lambda"],
      });
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).not.toContain("vpc: vpc.vpc");
    });

    it("TF: adds vpc_config block when vpcPlacement is true", () => {
      const result = generateProject({
        iac: "terraform",
        compute: ["lambda"],
        lambdaOptions: { vpcPlacement: true },
      });
      const lambdaTf = result.readText("infra/lambda.tf");
      expect(lambdaTf).toContain("vpc_config");
    });
  });

  describe("applyRdsEngineOption", () => {
    it("CDK: switches to MySQL when mysql engine is selected", () => {
      const result = generateProject({
        data: ["rds"],
        rdsOptions: { engine: "mysql" },
      });
      const construct = result.readText("infra/lib/constructs/rds.ts");
      expect(construct).toContain("MysqlEngineVersion");
      expect(construct).not.toContain("PostgresEngineVersion");
    });

    it("CDK: uses PostgreSQL by default", () => {
      const result = generateProject({
        data: ["rds"],
      });
      const construct = result.readText("infra/lib/constructs/rds.ts");
      expect(construct).toContain("PostgresEngineVersion");
    });

    it("TF: switches engine and port for MySQL", () => {
      const result = generateProject({
        iac: "terraform",
        data: ["rds"],
        rdsOptions: { engine: "mysql" },
      });
      const rdsTf = result.readText("infra/rds.tf");
      expect(rdsTf).toContain('"mysql"');
      expect(rdsTf).toContain("3306");
    });
  });

  describe("applyCloudWatchWidgets", () => {
    it("TF: adds Lambda metric widgets to dashboard", () => {
      const result = generateProject({
        iac: "terraform",
        compute: ["lambda"],
        observability: ["cloudwatch"],
      });
      const cwTf = result.readText("infra/cloudwatch.tf");
      expect(cwTf).toContain("Lambda Invocations & Errors");
    });

    it("CDK: adds addWidgets() calls to app-stack.ts", () => {
      const result = generateProject({
        compute: ["lambda"],
        observability: ["cloudwatch"],
      });
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("cloudWatchDashboard.addWidgets");
      expect(appStack).toContain("Lambda Invocations & Errors");
    });

    it("TF: no extra widgets when no services selected", () => {
      const result = generateProject({
        iac: "terraform",
        observability: ["cloudwatch"],
      });
      const cwTf = result.readText("infra/cloudwatch.tf");
      expect(cwTf).not.toContain("Lambda Invocations");
    });
  });

  describe("applyBedrockAgentKbWiring", () => {
    it("CDK: passes knowledgeBaseId to BedrockAgent", () => {
      const result = generateProject({
        ai: ["bedrock", "bedrock-kb", "bedrock-agents", "opensearch"],
      });
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("knowledgeBaseId:");
      expect(appStack).toContain("bedrockKb.knowledgeBase.attrKnowledgeBaseId");
    });
  });

  describe("applySqsLambdaWiring", () => {
    it("CDK: wires SQS queue as Lambda event source", () => {
      const result = generateProject({
        compute: ["lambda"],
        integration: ["sqs"],
      });
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("const sqsQueue");
      expect(appStack).toContain("SqsConsumer");
      expect(appStack).toContain("grantConsumeMessages");
    });

    it("TF: adds Lambda event source mapping for SQS", () => {
      const result = generateProject({
        iac: "terraform",
        compute: ["lambda"],
        integration: ["sqs"],
      });
      const sqsTf = result.readText("infra/sqs.tf");
      expect(sqsTf).toContain("aws_lambda_event_source_mapping");
    });
  });

  describe("applyEventBridgeLambdaWiring", () => {
    it("CDK: grants Lambda publish access to EventBridge", () => {
      const result = generateProject({
        compute: ["lambda"],
        integration: ["eventbridge"],
      });
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("const eventBus");
      expect(appStack).toContain("grantLambdaPublish");
    });
  });

  describe("applyDynamoDbLambdaIntegration", () => {
    it("CDK: grants Lambda access to DynamoDB", () => {
      const result = generateProject({
        compute: ["lambda"],
        data: ["dynamodb"],
      });
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("grantLambdaAccess");
    });
  });

  describe("variable scope — referenced constructs must be declared with const", () => {
    it("CDK: ecsService is declared when ECS + CloudWatch (no DynamoDB)", () => {
      const result = generateProject({
        compute: ["ecs"],
        ecsOptions: { launchType: "fargate", loadBalancer: "alb" },
        observability: ["cloudwatch"],
      });
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("const ecsService = new EcsService");
    });

    it("CDK: ecsService is declared when ECS + DynamoDB + CloudWatch", () => {
      const result = generateProject({
        compute: ["lambda", "ecs"],
        ecsOptions: { launchType: "fargate", loadBalancer: "alb" },
        data: ["dynamodb"],
        observability: ["cloudwatch"],
      });
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("const ecsService = new EcsService");
      // Should NOT have duplicate const declarations
      const matches = appStack.match(/const ecsService/g);
      expect(matches?.length).toBe(1);
    });

    it("CDK: cloudWatchDashboard is declared when CloudWatch + Lambda", () => {
      const result = generateProject({
        compute: ["lambda"],
        observability: ["cloudwatch"],
      });
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("const cloudWatchDashboard = new CloudWatchDashboard");
    });

    it("CDK: lambdaFunction is declared by preset (always const)", () => {
      const result = generateProject({
        compute: ["lambda"],
      });
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain("const lambdaFunction = new LambdaFunction");
    });
  });

  describe("sub-option integration — options affect generated output", () => {
    it("CDK: ECS NLB option switches to NetworkLoadBalancedFargateService", () => {
      const result = generateProject({
        compute: ["ecs"],
        ecsOptions: { launchType: "fargate", loadBalancer: "nlb" },
      });
      const construct = result.readText("infra/lib/constructs/ecs.ts");
      expect(construct).toContain("NetworkLoadBalancedFargateService");
      expect(construct).not.toContain("ApplicationLoadBalancedFargateService");
    });

    it("TF: ECS NLB option changes load_balancer_type", () => {
      const result = generateProject({
        iac: "terraform",
        compute: ["ecs"],
        ecsOptions: { launchType: "fargate", loadBalancer: "nlb" },
      });
      const ecsTf = result.readText("infra/ecs.tf");
      expect(ecsTf).toContain('"network"');
      expect(ecsTf).not.toContain('"application"');
    });

    it("CDK: EKS Fargate mode sets defaultCapacity 0 and adds Fargate profile", () => {
      const result = generateProject({
        compute: ["eks"],
        eksOptions: { mode: "fargate", loadBalancer: "alb" },
      });
      const construct = result.readText("infra/lib/constructs/eks.ts");
      expect(construct).toContain("defaultCapacity: 0");
      expect(construct).toContain("addFargateProfile");
      expect(construct).not.toContain("defaultCapacityInstance");
    });

    it("TF: EKS Fargate mode replaces node group with Fargate profile", () => {
      const result = generateProject({
        iac: "terraform",
        compute: ["eks"],
        eksOptions: { mode: "fargate", loadBalancer: "alb" },
      });
      const eksTf = result.readText("infra/eks.tf");
      expect(eksTf).toContain("aws_eks_fargate_profile");
      expect(eksTf).not.toContain("aws_eks_node_group");
    });

    it("CDK: API Gateway REST option switches type", () => {
      const result = generateProject({
        compute: ["lambda"],
        networking: ["api-gateway"],
        apiGatewayOptions: { type: "rest" },
      });
      const appStack = result.readText("infra/lib/app-stack.ts");
      expect(appStack).toContain('type: "rest"');
    });
  });
});
