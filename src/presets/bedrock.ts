import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

const BEDROCK_TF = `data "aws_iam_policy_document" "bedrock" {
  statement {
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = [
      "arn:aws:bedrock:\${var.aws_region}::foundation-model/anthropic.claude-*",
      "arn:aws:bedrock:\${var.aws_region}::foundation-model/amazon.titan-*",
    ]
  }
}

resource "aws_iam_policy" "bedrock" {
  name   = "\${var.project_name}-\${var.environment}-bedrock"
  policy = data.aws_iam_policy_document.bedrock.json
}
`;

const BEDROCK_TF_OUTPUTS = `output "bedrock_policy_arn" {
  description = "IAM policy ARN for Bedrock model invocation"
  value       = aws_iam_policy.bedrock.arn
}
`;

const BEDROCK_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

export class BedrockAccess extends Construct {
  public readonly policy: iam.ManagedPolicy;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.policy = new iam.ManagedPolicy(this, "Policy", {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream",
          ],
          resources: [
            \`arn:aws:bedrock:\${cdk.Aws.REGION}::foundation-model/anthropic.claude-*\`,
            \`arn:aws:bedrock:\${cdk.Aws.REGION}::foundation-model/amazon.titan-*\`,
          ],
        }),
      ],
    });
  }

  /** Attach the Bedrock invocation policy to an IAM role. */
  grantInvoke(role: iam.IRole): void {
    role.addManagedPolicy(this.policy);
  }
}
`;

export function createBedrockPreset(): Preset {
  const templates = readTemplates("bedrock");

  return {
    name: "bedrock",

    files: {
      ...templates,
    },

    merge: {
      "tsconfig.json": {
        include: ["lib"],
      },
      "package.json": {
        dependencies: {
          "@aws-sdk/client-bedrock-runtime": "^3.700.0",
        },
      },
      "renovate.json": {
        packageRules: [
          {
            groupName: "AWS SDK",
            matchPackagePatterns: ["^@aws-sdk/"],
          },
        ],
      },
    },

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/bedrock.ts": BEDROCK_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { BedrockAccess } from "./constructs/bedrock";',
            constructs: '    new BedrockAccess(this, "BedrockAccess");',
          },
        },
      },
      terraform: {
        files: {
          "infra/bedrock.tf": BEDROCK_TF,
        },
        merge: {
          "infra/outputs.tf": BEDROCK_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon Bedrock**: Foundation model API (Claude, Titan, etc.)",
        },
        {
          heading: "## Setup Checklist",
          content: "- [ ] **Bedrock**: Enable model access in the AWS Bedrock console",
        },
      ],
    },
  };
}
