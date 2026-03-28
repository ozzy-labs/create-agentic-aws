import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

const DYNAMODB_TABLE_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";

export class DynamoDbTable extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.table = new dynamodb.Table(this, "Table", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, "TableName", {
      value: this.table.tableName,
      description: "DynamoDB table name",
    });
  }
}
`;

export function createDynamoDbPreset(): Preset {
  const templates = readTemplates("dynamodb");

  return {
    name: "dynamodb",

    files: {
      ...templates,
    },

    merge: {
      "package.json": {
        devDependencies: {
          "@aws-sdk/client-dynamodb": "^3.700.0",
          "@aws-sdk/lib-dynamodb": "^3.700.0",
        },
      },
    },

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/dynamodb.ts": DYNAMODB_TABLE_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { DynamoDbTable } from "./constructs/dynamodb";',
            constructs: '    new DynamoDbTable(this, "DynamoDbTable");',
          },
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon DynamoDB**: NoSQL database (on-demand)",
        },
      ],
    },
  };
}
