import type { Preset } from "../types.js";

// ---------------------------------------------------------------------------
// CDK Construct — Bedrock Knowledge Base
// ---------------------------------------------------------------------------

const BEDROCK_KB_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export interface BedrockKnowledgeBaseProps {
  readonly collectionArn: string;
}

export class BedrockKnowledgeBase extends Construct {
  public readonly knowledgeBase: bedrock.CfnKnowledgeBase;
  public readonly dataSource: bedrock.CfnDataSource;
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: BedrockKnowledgeBaseProps) {
    super(scope, id);

    // S3 bucket for knowledge base documents
    this.bucket = new s3.Bucket(this, "DataBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // IAM role for the knowledge base
    const role = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["arn:aws:bedrock:*::foundation-model/*"],
      }),
    );

    this.bucket.grantRead(role);

    // Knowledge base with OpenSearch Serverless vector store
    this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, "KnowledgeBase", {
      name: cdk.Names.uniqueId(this).slice(0, 32),
      roleArn: role.roleArn,
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: \`arn:aws:bedrock:\${cdk.Aws.REGION}::foundation-model/amazon.titan-embed-text-v2:0\`,
        },
      },
      storageConfiguration: {
        type: "OPENSEARCH_SERVERLESS",
        opensearchServerlessConfiguration: {
          collectionArn: props.collectionArn,
          fieldMapping: {
            metadataField: "metadata",
            textField: "text",
            vectorField: "vector",
          },
          vectorIndexName: "kb-index",
        },
      },
    });

    // S3 data source
    this.dataSource = new bedrock.CfnDataSource(this, "DataSource", {
      knowledgeBaseId: this.knowledgeBase.attrKnowledgeBaseId,
      name: "s3-data-source",
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: {
          bucketArn: this.bucket.bucketArn,
        },
      },
    });

    new cdk.CfnOutput(this, "KnowledgeBaseId", {
      value: this.knowledgeBase.attrKnowledgeBaseId,
      description: "Bedrock Knowledge Base ID",
    });

    new cdk.CfnOutput(this, "DataBucketName", {
      value: this.bucket.bucketName,
      description: "S3 bucket for knowledge base documents",
    });
  }
}
`;

// ---------------------------------------------------------------------------
// Terraform — Bedrock Knowledge Base
// ---------------------------------------------------------------------------

const BEDROCK_KB_TF = `resource "aws_s3_bucket" "kb_data" {
  bucket_prefix = "\${var.project_name}-kb-data-"
  force_destroy = false
}

resource "aws_s3_bucket_public_access_block" "kb_data" {
  bucket                  = aws_s3_bucket.kb_data.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "kb_data" {
  bucket = aws_s3_bucket.kb_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

data "aws_iam_policy_document" "kb_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["bedrock.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "kb_policy" {
  statement {
    actions = [
      "bedrock:InvokeModel",
    ]
    resources = [
      "arn:aws:bedrock:\${var.aws_region}::foundation-model/*",
    ]
  }

  statement {
    actions = [
      "s3:GetObject",
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.kb_data.arn,
      "\${aws_s3_bucket.kb_data.arn}/*",
    ]
  }
}

resource "aws_iam_role" "kb" {
  name               = "\${var.project_name}-\${var.environment}-kb"
  assume_role_policy = data.aws_iam_policy_document.kb_trust.json
}

resource "aws_iam_role_policy" "kb" {
  name   = "\${var.project_name}-\${var.environment}-kb"
  role   = aws_iam_role.kb.id
  policy = data.aws_iam_policy_document.kb_policy.json
}

resource "aws_bedrockagent_knowledge_base" "this" {
  name     = "\${var.project_name}-\${var.environment}-kb"
  role_arn = aws_iam_role.kb.arn

  knowledge_base_configuration {
    type = "VECTOR"
    vector_knowledge_base_configuration {
      embedding_model_arn = "arn:aws:bedrock:\${var.aws_region}::foundation-model/amazon.titan-embed-text-v2:0"
    }
  }

  storage_configuration {
    type = "OPENSEARCH_SERVERLESS"
    opensearch_serverless_configuration {
      collection_arn    = "TODO: Set your OpenSearch Serverless collection ARN"
      vector_index_name = "kb-index"
      field_mapping {
        metadata_field = "metadata"
        text_field     = "text"
        vector_field   = "vector"
      }
    }
  }
}

resource "aws_bedrockagent_data_source" "s3" {
  knowledge_base_id = aws_bedrockagent_knowledge_base.this.id
  name              = "s3-data-source"

  data_source_configuration {
    type = "S3"
    s3_configuration {
      bucket_arn = aws_s3_bucket.kb_data.arn
    }
  }
}
`;

const BEDROCK_KB_TF_OUTPUTS = `output "bedrock_kb_id" {
  description = "Bedrock Knowledge Base ID"
  value       = aws_bedrockagent_knowledge_base.this.id
}

output "bedrock_kb_data_bucket" {
  description = "S3 bucket for knowledge base documents"
  value       = aws_s3_bucket.kb_data.id
}
`;

// ---------------------------------------------------------------------------
// Preset factory
// ---------------------------------------------------------------------------

export function createBedrockKbPreset(): Preset {
  return {
    name: "bedrock-kb",

    requires: ["bedrock", "opensearch"],

    files: {},

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/bedrock-kb.ts": BEDROCK_KB_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { BedrockKnowledgeBase } from "./constructs/bedrock-kb";',
            constructs:
              '    new BedrockKnowledgeBase(this, "BedrockKnowledgeBase", { collectionArn: "TODO: Set your OpenSearch Serverless collection ARN" });',
          },
        },
      },
      terraform: {
        files: {
          "infra/bedrock-kb.tf": BEDROCK_KB_TF,
        },
        merge: {
          "infra/outputs.tf": BEDROCK_KB_TF_OUTPUTS,
        },
      },
    },

    awsResources: [
      { service: "Bedrock", type: "Knowledge Base" },
      { service: "Bedrock", type: "Data Source" },
      { service: "S3", type: "Bucket (KB data)" },
      { service: "IAM", type: "Role (Knowledge Base)" },
    ],

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content:
            "- **Bedrock Knowledge Bases**: RAG (Retrieval-Augmented Generation) with S3 data source",
        },
        {
          heading: "## Setup Checklist",
          content: "- [ ] **Bedrock KB**: Upload documents to the S3 data source bucket",
        },
      ],
    },
  };
}
