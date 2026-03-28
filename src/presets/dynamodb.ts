import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

const DYNAMODB_TF = `resource "aws_dynamodb_table" "this" {
  name         = "\${var.project_name}-\${var.environment}-table"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}
`;

const DYNAMODB_TF_OUTPUTS = `output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.this.name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN"
  value       = aws_dynamodb_table.this.arn
}
`;

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
        dependencies: {
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
      terraform: {
        files: {
          "infra/dynamodb.tf": DYNAMODB_TF,
        },
        merge: {
          "infra/outputs.tf": DYNAMODB_TF_OUTPUTS,
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
