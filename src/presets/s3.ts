import type { Preset } from "../types.js";

const S3_TF = `resource "aws_s3_bucket" "this" {
  bucket_prefix = "\${var.project_name}-\${var.environment}-"
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
`;

const S3_TF_OUTPUTS = `output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.this.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.this.arn
}
`;

const S3_BUCKET_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export class S3Bucket extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, "Bucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    new cdk.CfnOutput(this, "BucketName", {
      value: this.bucket.bucketName,
      description: "S3 bucket name",
    });
  }
}
`;

export function createS3Preset(): Preset {
  return {
    name: "s3",

    files: {},

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/s3.ts": S3_BUCKET_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { S3Bucket } from "./constructs/s3";',
            constructs: '    const s3Bucket = new S3Bucket(this, "S3Bucket");',
          },
        },
      },
      terraform: {
        files: {
          "infra/s3.tf": S3_TF,
        },
        merge: {
          "infra/outputs.tf": S3_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon S3**: Object storage",
        },
      ],
    },
  };
}
