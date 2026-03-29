import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

const SQS_TF = `resource "aws_sqs_queue" "dlq" {
  name                      = "\${var.project_name}-\${var.environment}-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "this" {
  name                       = "\${var.project_name}-\${var.environment}-queue"
  visibility_timeout_seconds = 30
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}
`;

const SQS_TF_OUTPUTS = `output "sqs_queue_url" {
  description = "SQS queue URL"
  value       = aws_sqs_queue.this.url
}

output "sqs_dlq_url" {
  description = "SQS dead-letter queue URL"
  value       = aws_sqs_queue.dlq.url
}
`;

const SQS_QUEUE_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

export class SqsQueue extends Construct {
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.deadLetterQueue = new sqs.Queue(this, "DLQ", {
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    this.queue = new sqs.Queue(this, "Queue", {
      visibilityTimeout: cdk.Duration.seconds(30),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    new cdk.CfnOutput(this, "QueueUrl", {
      value: this.queue.queueUrl,
      description: "SQS queue URL",
    });

    new cdk.CfnOutput(this, "DlqUrl", {
      value: this.deadLetterQueue.queueUrl,
      description: "SQS dead-letter queue URL",
    });
  }
}
`;

export function createSqsPreset(): Preset {
  const templates = readTemplates("sqs");

  return {
    name: "sqs",

    files: {
      ...templates,
    },

    merge: {
      "tsconfig.json": {
        include: ["lib"],
      },
      "package.json": {
        devDependencies: {
          "@types/aws-lambda": "^8.10.0",
        },
      },
    },

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/sqs.ts": SQS_QUEUE_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { SqsQueue } from "./constructs/sqs";',
            constructs: '    new SqsQueue(this, "SqsQueue");',
          },
        },
      },
      terraform: {
        files: {
          "infra/sqs.tf": SQS_TF,
        },
        merge: {
          "infra/outputs.tf": SQS_TF_OUTPUTS,
        },
      },
    },

    awsResources: [
      { service: "SQS", type: "Queue" },
      { service: "SQS", type: "Dead-Letter Queue" },
    ],

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon SQS**: Message queue with dead-letter queue",
        },
        {
          heading: "## Setup Checklist",
          content:
            "- [ ] **SQS**: Review DLQ retention period and redrive policy in the construct/`.tf` file",
        },
      ],
    },
  };
}
