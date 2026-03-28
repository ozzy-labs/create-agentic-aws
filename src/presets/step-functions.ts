import type { Preset } from "../types.js";

const STEP_FUNCTIONS_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import type { Construct } from "constructs";

export class StepFunctionsWorkflow extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Define your workflow steps here.
    const definition = new sfn.Pass(this, "ProcessInput", {
      result: sfn.Result.fromObject({ status: "processed" }),
    }).next(
      new sfn.Choice(this, "CheckResult")
        .when(sfn.Condition.stringEquals("$.status", "processed"), new sfn.Succeed(this, "Success"))
        .otherwise(new sfn.Fail(this, "Fail", { error: "WorkflowFailed", cause: "Processing failed" })),
    );

    this.stateMachine = new sfn.StateMachine(this, "StateMachine", {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
      },
    });

    new cdk.CfnOutput(this, "StateMachineArn", {
      value: this.stateMachine.stateMachineArn,
      description: "Step Functions state machine ARN",
    });
  }
}
`;

const STEP_FUNCTIONS_TF = `resource "aws_sfn_state_machine" "this" {
  name     = "\${var.project_name}-\${var.environment}-workflow"
  role_arn = aws_iam_role.sfn.arn

  definition = jsonencode({
    Comment = "\${var.project_name} workflow"
    StartAt = "ProcessInput"
    States = {
      ProcessInput = {
        Type   = "Pass"
        Result = { status = "processed" }
        Next   = "CheckResult"
      }
      CheckResult = {
        Type = "Choice"
        Choices = [{
          Variable     = "$.status"
          StringEquals = "processed"
          Next         = "Success"
        }]
        Default = "Fail"
      }
      Success = {
        Type = "Succeed"
      }
      Fail = {
        Type  = "Fail"
        Error = "WorkflowFailed"
        Cause = "Processing failed"
      }
    }
  })

  logging_configuration {
    log_destination        = "\${aws_cloudwatch_log_group.sfn.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  tracing_configuration {
    enabled = true
  }
}

resource "aws_cloudwatch_log_group" "sfn" {
  name              = "/aws/states/\${var.project_name}-\${var.environment}"
  retention_in_days = 30
}

resource "aws_iam_role" "sfn" {
  name = "\${var.project_name}-sfn-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "states.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "sfn_logging" {
  name = "\${var.project_name}-sfn-logging"
  role = aws_iam_role.sfn.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogDelivery",
        "logs:GetLogDelivery",
        "logs:UpdateLogDelivery",
        "logs:DeleteLogDelivery",
        "logs:ListLogDeliveries",
        "logs:PutResourcePolicy",
        "logs:DescribeResourcePolicies",
        "logs:DescribeLogGroups",
      ]
      Resource = "*"
    }]
  })
}
`;

const STEP_FUNCTIONS_TF_OUTPUTS = `output "step_functions_state_machine_arn" {
  description = "Step Functions state machine ARN"
  value       = aws_sfn_state_machine.this.arn
}
`;

export function createStepFunctionsPreset(): Preset {
  return {
    name: "step-functions",

    files: {},

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/step-functions.ts": STEP_FUNCTIONS_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { StepFunctionsWorkflow } from "./constructs/step-functions";',
            constructs: '    new StepFunctionsWorkflow(this, "StepFunctionsWorkflow");',
          },
        },
      },
      terraform: {
        files: {
          "infra/step-functions.tf": STEP_FUNCTIONS_TF,
        },
        merge: {
          "infra/outputs.tf": STEP_FUNCTIONS_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **AWS Step Functions**: Workflow orchestration",
        },
      ],
    },
  };
}
