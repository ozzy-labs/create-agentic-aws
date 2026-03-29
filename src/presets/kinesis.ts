import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

// ---------------------------------------------------------------------------
// CDK Construct — Kinesis Data Stream
// ---------------------------------------------------------------------------

const KINESIS_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as kinesis from "aws-cdk-lib/aws-kinesis";
import type { Construct } from "constructs";

export class KinesisStream extends Construct {
  public readonly stream: kinesis.Stream;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.stream = new kinesis.Stream(this, "Stream", {
      streamMode: kinesis.StreamMode.ON_DEMAND,
      encryption: kinesis.StreamEncryption.MANAGED,
      retentionPeriod: cdk.Duration.hours(24),
    });

    new cdk.CfnOutput(this, "StreamName", {
      value: this.stream.streamName,
      description: "Kinesis Data Stream name",
    });

    new cdk.CfnOutput(this, "StreamArn", {
      value: this.stream.streamArn,
      description: "Kinesis Data Stream ARN",
    });
  }
}
`;

// ---------------------------------------------------------------------------
// Terraform — Kinesis Data Stream
// ---------------------------------------------------------------------------

const KINESIS_TF = `resource "aws_kinesis_stream" "this" {
  name             = "\${var.project_name}-\${var.environment}"
  stream_mode_details {
    stream_mode = "ON_DEMAND"
  }
  encryption_type = "KMS"                # AWS-managed encryption (equivalent to CDK StreamEncryption.MANAGED)
  kms_key_id      = "alias/aws/kinesis"
  retention_period = 24

  tags = {
    Name = "\${var.project_name}-\${var.environment}-stream"
  }
}
`;

const KINESIS_TF_OUTPUTS = `output "kinesis_stream_name" {
  description = "Kinesis Data Stream name"
  value       = aws_kinesis_stream.this.name
}

output "kinesis_stream_arn" {
  description = "Kinesis Data Stream ARN"
  value       = aws_kinesis_stream.this.arn
}
`;

// ---------------------------------------------------------------------------
// Preset factory
// ---------------------------------------------------------------------------

export function createKinesisPreset(): Preset {
  const templates = readTemplates("kinesis");

  return {
    name: "kinesis",

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
          "infra/lib/constructs/kinesis.ts": KINESIS_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { KinesisStream } from "./constructs/kinesis";',
            constructs: '    new KinesisStream(this, "KinesisStream");',
          },
        },
      },
      terraform: {
        files: {
          "infra/kinesis.tf": KINESIS_TF,
        },
        merge: {
          "infra/outputs.tf": KINESIS_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon Kinesis Data Streams**: Real-time data streaming (on-demand mode)",
        },
      ],
    },
  };
}
