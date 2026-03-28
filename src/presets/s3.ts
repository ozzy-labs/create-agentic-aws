import type { Preset } from "../types.js";

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
            constructs: '    new S3Bucket(this, "S3Bucket");',
          },
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
