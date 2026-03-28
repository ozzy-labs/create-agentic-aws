import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

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
      runtime: lambda.Runtime.NODEJS_22_X,
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
      "package.json": {
        devDependencies: {
          "@aws-lambda-powertools/logger": "^2.14.0",
          "@aws-lambda-powertools/metrics": "^2.14.0",
          "@aws-lambda-powertools/tracer": "^2.14.0",
          "@types/aws-lambda": "^8.10.0",
        },
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
            constructs: '    new LambdaFunction(this, "LambdaFunction");',
          },
          "infra/package.json": {
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
            "- **AWS Lambda**: Serverless compute (Node.js 22)\n- **Lambda Powertools**: Structured logging, tracing",
        },
      ],
    },
  };
}
