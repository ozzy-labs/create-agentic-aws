import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

const LAMBDA_TF = `resource "null_resource" "lambda_build" {
  triggers = {
    source_hash = sha256(join("", [for f in fileset("\${path.module}/../lambda/handlers", "**/*.ts") : filemd5("\${path.module}/../lambda/handlers/\${f}")]))
  }

  provisioner "local-exec" {
    command = "npx esbuild lambda/handlers/index.ts --bundle --platform=node --target=node24 --outfile=lambda/handlers/dist/index.mjs --format=esm"
  }
}

data "archive_file" "lambda" {
  type        = "zip"
  source_file = "\${path.module}/../lambda/handlers/dist/index.mjs"
  output_path = "\${path.module}/.build/lambda.zip"

  depends_on = [null_resource.lambda_build]
}

resource "aws_lambda_function" "this" {
  function_name    = "\${var.project_name}-handler"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  memory_size      = var.lambda_memory_size
  timeout          = 30
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  environment {
    variables = {
      NODE_OPTIONS = "--enable-source-maps"
    }
  }
}

resource "aws_iam_role" "lambda" {
  name = "\${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
`;

const LAMBDA_TF_VARS = `variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 256
}
`;

const LAMBDA_TF_OUTPUTS = `output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.this.function_name
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.this.arn
}
`;

const LAMBDA_CONSTRUCT = `import { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";
import { join } from "node:path";

export interface LambdaFunctionProps {
  /** Optional VPC for private Lambda placement. */
  readonly vpc?: import("aws-cdk-lib/aws-ec2").IVpc;
}

export class LambdaFunction extends Construct {
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string, props?: LambdaFunctionProps) {
    super(scope, id);

    this.handler = new NodejsFunction(this, "Handler", {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: join(__dirname, "..", "..", "..", "lambda", "handlers", "index.ts"),
      handler: "handler",
      memorySize: 256,
      timeout: Duration.seconds(30),
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
      },
      ...(props?.vpc && {
        vpc: props.vpc,
      }),
    });
  }
}
`;

export function createLambdaPreset(): Preset {
  const templates = readTemplates("lambda");

  return {
    name: "lambda",

    files: {
      ...templates,
    },

    merge: {
      "tsconfig.json": {
        include: ["lambda", "lib"],
      },
      "package.json": {
        dependencies: {
          "@aws-lambda-powertools/logger": "^2.14.0",
          "@aws-lambda-powertools/metrics": "^2.14.0",
          "@aws-lambda-powertools/tracer": "^2.14.0",
          "@middy/core": "^6.0.0",
        },
        devDependencies: {
          "@types/aws-lambda": "^8.10.0",
        },
      },
      "renovate.json": {
        packageRules: [
          {
            groupName: "AWS Lambda Powertools",
            matchPackagePatterns: ["^@aws-lambda-powertools/"],
          },
        ],
      },
    },

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/lambda.ts": LAMBDA_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { LambdaFunction } from "./constructs/lambda";',
            constructs: '    const lambdaFunction = new LambdaFunction(this, "LambdaFunction");',
          },
          "infra/package.json": {
            devDependencies: {
              esbuild: "^0.25.0",
            },
          },
        },
      },
      terraform: {
        files: {
          "infra/lambda.tf": LAMBDA_TF,
        },
        merge: {
          "infra/variables.tf": LAMBDA_TF_VARS,
          "infra/outputs.tf": LAMBDA_TF_OUTPUTS,
          "package.json": {
            devDependencies: {
              esbuild: "^0.25.0",
            },
          },
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content:
            "- **AWS Lambda**: Serverless compute (Node.js 24)\n- **Lambda Powertools**: Structured logging, metrics, tracing",
        },
      ],
    },
  };
}
