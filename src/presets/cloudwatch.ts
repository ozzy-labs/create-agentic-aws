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

# --- SNS Topic for CloudWatch Alarms ---

resource "aws_sns_topic" "alarms" {
  name = "\${var.project_name}-\${var.environment}-alarms"
}

# TODO: Add per-service alarms (Lambda errors, ECS health, RDS connections, etc.)
# Example:
# resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
#   alarm_name          = "\${var.project_name}-lambda-errors"
#   comparison_operator = "GreaterThanThreshold"
#   evaluation_periods  = 1
#   metric_name         = "Errors"
#   namespace           = "AWS/Lambda"
#   period              = 300
#   statistic           = "Sum"
#   threshold           = 0
#   alarm_actions       = [aws_sns_topic.alarms.arn]
# }
`;

const CLOUDWATCH_TF_OUTPUTS = `output "cloudwatch_dashboard_name" {
  description = "CloudWatch dashboard name"
  value       = aws_cloudwatch_dashboard.this.dashboard_name
}

output "cloudwatch_sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  value       = aws_sns_topic.alarms.arn
}
`;

const CLOUDWATCH_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as sns from "aws-cdk-lib/aws-sns";
import type { Construct } from "constructs";

export class CloudWatchDashboard extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.alarmTopic = new sns.Topic(this, "AlarmTopic", {
      topicName: \`\${cdk.Stack.of(this).stackName}-alarms\`,
      displayName: "CloudWatch Alarms",
    });

    this.dashboard = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: \`\${cdk.Stack.of(this).stackName}-dashboard\`,
      defaultInterval: cdk.Duration.hours(3),
    });

    new cdk.CfnOutput(this, "AlarmTopicArn", {
      value: this.alarmTopic.topicArn,
      description: "SNS topic ARN for CloudWatch alarms",
    });
  }

  /** Add custom metric widgets to the dashboard. */
  addWidgets(...widgets: cloudwatch.IWidget[]): void {
    this.dashboard.addWidgets(...widgets);
  }

  // TODO: Add per-service alarms (Lambda errors, ECS health, RDS connections, etc.)
  // Example:
  // import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
  // const alarm = new cloudwatch.Alarm(this, "LambdaErrors", { ... });
  // alarm.addAlarmAction(new cw_actions.SnsAction(this.alarmTopic));
}
`;

export function createCloudWatchPreset(): Preset {
  const templates = readTemplates("cloudwatch");

  return {
    name: "cloudwatch",

    files: {
      ...templates,
    },

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/cloudwatch.ts": CLOUDWATCH_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { CloudWatchDashboard } from "./constructs/cloudwatch";',
            constructs: '    new CloudWatchDashboard(this, "CloudWatchDashboard");',
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
          content:
            "- **Amazon CloudWatch**: Monitoring dashboard and alarms\n- **Amazon SNS**: Alarm notifications",
        },
        {
          heading: "## Setup Checklist",
          content:
            "- [ ] **CloudWatch**: Add an SNS subscription (email, Slack, PagerDuty, etc.) to the alarms topic",
        },
      ],
    },
  };
}
