import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

// ---------------------------------------------------------------------------
// CDK Construct — Bedrock Agent
// ---------------------------------------------------------------------------

const BEDROCK_AGENTS_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import type { Construct } from "constructs";

export interface BedrockAgentProps {
  readonly actionGroupLambda: lambda.IFunction;
}

export class BedrockAgent extends Construct {
  public readonly agent: bedrock.CfnAgent;

  constructor(scope: Construct, id: string, props: BedrockAgentProps) {
    super(scope, id);

    const role = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:Retrieve",
        ],
        resources: ["*"],
      }),
    );

    this.agent = new bedrock.CfnAgent(this, "Agent", {
      agentName: cdk.Names.uniqueId(this).slice(0, 32),
      agentResourceRoleArn: role.roleArn,
      foundationModel: "anthropic.claude-3-5-sonnet-20241022-v2:0",
      instruction: "You are a helpful assistant. Use the available action groups to help users.",
      idleSessionTtlInSeconds: 600,
      actionGroups: [
        {
          actionGroupName: "default-action-group",
          actionGroupExecutor: {
            lambda: props.actionGroupLambda.functionArn,
          },
          apiSchema: {
            payload: JSON.stringify({
              openapi: "3.0.0",
              info: { title: "Action Group API", version: "1.0.0" },
              paths: {
                "/action": {
                  post: {
                    operationId: "executeAction",
                    description: "Execute an action",
                    responses: {
                      "200": { description: "Successful response" },
                    },
                  },
                },
              },
            }),
          },
        },
      ],
    });

    // Grant the agent permission to invoke the Lambda
    props.actionGroupLambda.addPermission("BedrockAgentInvoke", {
      principal: new iam.ServicePrincipal("bedrock.amazonaws.com"),
      sourceArn: this.agent.attrAgentArn,
    });

    new cdk.CfnOutput(this, "AgentId", {
      value: this.agent.attrAgentId,
      description: "Bedrock Agent ID",
    });

    new cdk.CfnOutput(this, "AgentArn", {
      value: this.agent.attrAgentArn,
      description: "Bedrock Agent ARN",
    });
  }
}
`;

// ---------------------------------------------------------------------------
// Terraform — Bedrock Agent
// ---------------------------------------------------------------------------

const BEDROCK_AGENTS_TF = `data "aws_iam_policy_document" "agent_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["bedrock.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "agent_policy" {
  statement {
    actions = [
      "bedrock:InvokeModel",
      "bedrock:Retrieve",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role" "agent" {
  name               = "\${var.project_name}-\${var.environment}-agent"
  assume_role_policy = data.aws_iam_policy_document.agent_trust.json
}

resource "aws_iam_role_policy" "agent" {
  name   = "\${var.project_name}-\${var.environment}-agent"
  role   = aws_iam_role.agent.id
  policy = data.aws_iam_policy_document.agent_policy.json
}

resource "aws_lambda_function" "action_group" {
  function_name = "\${var.project_name}-\${var.environment}-action-group"
  role          = aws_iam_role.action_group_lambda.arn
  handler       = "action-group.handler"
  runtime       = "nodejs24.x"
  filename      = "lambda/handlers/action-group.zip"
  memory_size   = 256
  timeout       = 30

  environment {
    variables = {
      NODE_OPTIONS = "--enable-source-maps"
    }
  }
}

data "aws_iam_policy_document" "action_group_lambda_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "action_group_lambda" {
  name               = "\${var.project_name}-\${var.environment}-action-group-lambda"
  assume_role_policy = data.aws_iam_policy_document.action_group_lambda_trust.json
}

resource "aws_iam_role_policy_attachment" "action_group_lambda_basic" {
  role       = aws_iam_role.action_group_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_permission" "agent_invoke" {
  statement_id  = "AllowBedrockAgentInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.action_group.function_name
  principal     = "bedrock.amazonaws.com"
  source_arn    = aws_bedrockagent_agent.this.agent_arn
}

resource "aws_bedrockagent_agent" "this" {
  agent_name              = "\${var.project_name}-\${var.environment}-agent"
  agent_resource_role_arn = aws_iam_role.agent.arn
  foundation_model        = "anthropic.claude-3-5-sonnet-20241022-v2:0"
  instruction             = "You are a helpful assistant. Use the available action groups to help users."
  idle_session_ttl_in_seconds = 600
}

resource "aws_bedrockagent_agent_action_group" "default" {
  action_group_name          = "default-action-group"
  agent_id                   = aws_bedrockagent_agent.this.agent_id
  agent_version              = "DRAFT"
  action_group_executor {
    lambda = aws_lambda_function.action_group.arn
  }
  api_schema {
    payload = jsonencode({
      openapi = "3.0.0"
      info    = { title = "Action Group API", version = "1.0.0" }
      paths = {
        "/action" = {
          post = {
            operationId = "executeAction"
            description = "Execute an action"
            responses   = { "200" = { description = "Successful response" } }
          }
        }
      }
    })
  }
}
`;

const BEDROCK_AGENTS_TF_OUTPUTS = `output "bedrock_agent_id" {
  description = "Bedrock Agent ID"
  value       = aws_bedrockagent_agent.this.agent_id
}

output "bedrock_agent_action_group_lambda_arn" {
  description = "Action Group Lambda function ARN"
  value       = aws_lambda_function.action_group.arn
}
`;

// ---------------------------------------------------------------------------
// Preset factory
// ---------------------------------------------------------------------------

export function createBedrockAgentsPreset(): Preset {
  const templates = readTemplates("bedrock-agents");

  return {
    name: "bedrock-agents",

    requires: ["bedrock-kb"],

    files: {
      ...templates,
    },

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/bedrock-agents.ts": BEDROCK_AGENTS_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { BedrockAgent } from "./constructs/bedrock-agents";',
            constructs:
              '    new BedrockAgent(this, "BedrockAgent", { actionGroupLambda: undefined! });',
          },
        },
      },
      terraform: {
        files: {
          "infra/bedrock-agents.tf": BEDROCK_AGENTS_TF,
        },
        merge: {
          "infra/outputs.tf": BEDROCK_AGENTS_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Bedrock Agents**: Autonomous AI agent with Action Group Lambda handler",
        },
      ],
    },
  };
}
