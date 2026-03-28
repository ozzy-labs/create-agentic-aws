import type { Preset } from "../types.js";

const CLOUDFRONT_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export interface CloudFrontDistributionProps {
  /** Optional S3 bucket to use as the origin. Creates a new one if omitted. */
  readonly originBucket?: s3.IBucket;
}

export class CloudFrontDistribution extends Construct {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: CloudFrontDistributionProps) {
    super(scope, id);

    const bucket =
      props?.originBucket ??
      new s3.Bucket(this, "OriginBucket", {
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: "index.html",
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    new cdk.CfnOutput(this, "DistributionDomainName", {
      value: this.distribution.distributionDomainName,
      description: "CloudFront distribution domain name",
    });

    new cdk.CfnOutput(this, "DistributionId", {
      value: this.distribution.distributionId,
      description: "CloudFront distribution ID",
    });
  }
}
`;

export function createCloudFrontPreset(): Preset {
  return {
    name: "cloudfront",

    files: {},

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/cloudfront.ts": CLOUDFRONT_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { CloudFrontDistribution } from "./constructs/cloudfront";',
            constructs: '    new CloudFrontDistribution(this, "CloudFrontDistribution");',
          },
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon CloudFront**: CDN distribution",
        },
      ],
    },
  };
}
