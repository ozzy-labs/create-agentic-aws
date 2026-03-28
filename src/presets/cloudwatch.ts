import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

const CLOUDWATCH_TF = `resource "aws_cloudwatch_dashboard" "this" {
  dashboard_name = "\${var.project_name}-\${var.environment}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "# \${var.project_name} Dashboard"
        }
      }
    ]
  })
}
`;

const CLOUDWATCH_TF_OUTPUTS = `output "cloudwatch_dashboard_name" {
  description = "CloudWatch dashboard name"
  value       = aws_cloudwatch_dashboard.this.dashboard_name
}
`;

const CLOUDWATCH_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import type * as lambda from "aws-cdk-lib/aws-lambda";
import type { Construct } from "constructs";

export interface CloudWatchDashboardProps {
  /** Lambda function to monitor. */
  readonly handler: lambda.IFunction;
}

export class CloudWatchDashboard extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: CloudWatchDashboardProps) {
    super(scope, id);

    this.dashboard = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: \`\${cdk.Stack.of(this).stackName}-dashboard\`,
      defaultInterval: cdk.Duration.hours(3),
    });

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Lambda Invocations",
        left: [props.handler.metricInvocations()],
      }),
      new cloudwatch.GraphWidget({
        title: "Lambda Errors",
        left: [props.handler.metricErrors()],
      }),
      new cloudwatch.GraphWidget({
        title: "Lambda Duration",
        left: [props.handler.metricDuration()],
      }),
      new cloudwatch.GraphWidget({
        title: "Lambda Throttles",
        left: [props.handler.metricThrottles()],
      }),
    );
  }
}
`;

export function createCloudWatchPreset(): Preset {
  const templates = readTemplates("cloudwatch");

  return {
    name: "cloudwatch",

    requires: ["lambda"],

    files: {
      ...templates,
    },

    merge: {
      "tsconfig.json": {
        include: ["lib"],
      },
      "package.json": {
        dependencies: {
          "@aws-lambda-powertools/logger": "^2.14.0",
          "@aws-lambda-powertools/metrics": "^2.14.0",
          "@aws-lambda-powertools/tracer": "^2.14.0",
          "@middy/core": "^6.0.0",
        },
      },
    },

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/cloudwatch.ts": CLOUDWATCH_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { CloudWatchDashboard } from "./constructs/cloudwatch";',
            constructs:
              '    new CloudWatchDashboard(this, "CloudWatchDashboard", {\n      handler: lambdaFunction.handler,\n    });',
          },
        },
      },
      terraform: {
        files: {
          "infra/cloudwatch.tf": CLOUDWATCH_TF,
        },
        merge: {
          "infra/outputs.tf": CLOUDWATCH_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon CloudWatch**: Monitoring dashboard",
        },
      ],
    },
  };
}
