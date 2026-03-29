import type { Preset } from "../types.js";

const SNS_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as sns from "aws-cdk-lib/aws-sns";
import type { Construct } from "constructs";

export class SnsTopic extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.topic = new sns.Topic(this, "Topic", {
      displayName: id,
      enforceSSL: true,
    });

    new cdk.CfnOutput(this, "TopicArn", {
      value: this.topic.topicArn,
      description: "SNS topic ARN",
    });
  }
}
`;

const SNS_TF = `resource "aws_sns_topic" "this" {
  name = "\${var.project_name}-\${var.environment}-topic"
}

resource "aws_sns_topic_policy" "this" {
  arn = aws_sns_topic.this.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "EnforceSSL"
      Effect    = "Deny"
      Principal = "*"
      Action    = "SNS:Publish"
      Resource  = aws_sns_topic.this.arn
      Condition = {
        Bool = { "aws:SecureTransport" = "false" }
      }
    }]
  })
}
`;

const SNS_TF_OUTPUTS = `output "sns_topic_arn" {
  description = "SNS topic ARN"
  value       = aws_sns_topic.this.arn
}
`;

export function createSnsPreset(): Preset {
  return {
    name: "sns",

    files: {},

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/sns.ts": SNS_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { SnsTopic } from "./constructs/sns";',
            constructs: '    new SnsTopic(this, "SnsTopic");',
          },
        },
      },
      terraform: {
        files: {
          "infra/sns.tf": SNS_TF,
        },
        merge: {
          "infra/outputs.tf": SNS_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon SNS**: Pub/sub messaging",
        },
        {
          heading: "## Setup Checklist",
          content: "- [ ] **SNS**: Add subscriptions (email, SQS, Lambda, etc.) to the topic",
        },
      ],
    },
  };
}
