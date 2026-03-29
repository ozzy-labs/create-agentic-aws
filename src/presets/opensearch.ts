import type { Preset } from "../types.js";

// ---------------------------------------------------------------------------
// CDK Construct — OpenSearch Serverless Collection (default)
// ---------------------------------------------------------------------------

const OPENSEARCH_SERVERLESS_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as opensearchserverless from "aws-cdk-lib/aws-opensearchserverless";
import type { Construct } from "constructs";

export class OpenSearchCollection extends Construct {
  public readonly collection: opensearchserverless.CfnCollection;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      "EncryptionPolicy",
      {
        name: cdk.Names.uniqueId(this).toLowerCase().slice(0, 28) + "-enc",
        type: "encryption",
        policy: JSON.stringify({
          Rules: [
            {
              ResourceType: "collection",
              Resource: [\`collection/\${cdk.Names.uniqueId(this).toLowerCase().slice(0, 28)}\`],
            },
          ],
          AWSOwnedKey: true,
        }),
      },
    );

    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      "NetworkPolicy",
      {
        name: cdk.Names.uniqueId(this).toLowerCase().slice(0, 28) + "-net",
        type: "network",
        policy: JSON.stringify([
          {
            Rules: [
              {
                ResourceType: "collection",
                Resource: [\`collection/\${cdk.Names.uniqueId(this).toLowerCase().slice(0, 28)}\`],
              },
            ],
            AllowFromPublic: false,
          },
        ]),
      },
    );

    this.collection = new opensearchserverless.CfnCollection(this, "Collection", {
      name: cdk.Names.uniqueId(this).toLowerCase().slice(0, 28),
      type: "SEARCH",
    });

    this.collection.addDependency(encryptionPolicy);
    this.collection.addDependency(networkPolicy);

    new cdk.CfnOutput(this, "CollectionEndpoint", {
      value: this.collection.attrCollectionEndpoint,
      description: "OpenSearch Serverless collection endpoint",
    });

    new cdk.CfnOutput(this, "CollectionArn", {
      value: this.collection.attrArn,
      description: "OpenSearch Serverless collection ARN",
    });
  }
}
`;

// ---------------------------------------------------------------------------
// CDK Construct — OpenSearch Managed Cluster (Domain)
// ---------------------------------------------------------------------------

export const OPENSEARCH_MANAGED_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as opensearch from "aws-cdk-lib/aws-opensearchservice";
import type { Construct } from "constructs";

export interface OpenSearchDomainProps {
  readonly vpc: ec2.IVpc;
}

export class OpenSearchDomain extends Construct {
  public readonly domain: opensearch.Domain;

  constructor(scope: Construct, id: string, props: OpenSearchDomainProps) {
    super(scope, id);

    this.domain = new opensearch.Domain(this, "Domain", {
      version: opensearch.EngineVersion.OPENSEARCH_2_17,
      capacity: {
        dataNodeInstanceType: "r6g.large.search",
        dataNodes: 2,
      },
      ebs: {
        volumeSize: 20,
        volumeType: ec2.EbsDeviceVolumeType.GP3,
      },
      vpc: props.vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
      zoneAwareness: { enabled: true, availabilityZoneCount: 2 },
      nodeToNodeEncryption: true,
      encryptionAtRest: { enabled: true },
      enforceHttps: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, "DomainEndpoint", {
      value: this.domain.domainEndpoint,
      description: "OpenSearch domain endpoint",
    });

    new cdk.CfnOutput(this, "DomainArn", {
      value: this.domain.domainArn,
      description: "OpenSearch domain ARN",
    });
  }
}
`;

// ---------------------------------------------------------------------------
// Terraform — OpenSearch Serverless (default)
// ---------------------------------------------------------------------------

const OPENSEARCH_SERVERLESS_TF = `resource "aws_opensearchserverless_security_policy" "encryption" {
  name = "\${var.project_name}-\${var.environment}-enc"
  type = "encryption"
  policy = jsonencode({
    Rules = [
      {
        ResourceType = "collection"
        Resource     = ["collection/\${var.project_name}-\${var.environment}"]
      }
    ]
    AWSOwnedKey = true
  })
}

resource "aws_opensearchserverless_security_policy" "network" {
  name = "\${var.project_name}-\${var.environment}-net"
  type = "network"
  policy = jsonencode([
    {
      Rules = [
        {
          ResourceType = "collection"
          Resource     = ["collection/\${var.project_name}-\${var.environment}"]
        }
      ]
      AllowFromPublic = false
    }
  ])
}

resource "aws_opensearchserverless_access_policy" "data" {
  name = "\${var.project_name}-\${var.environment}-data"
  type = "data"
  policy = jsonencode([
    {
      Rules = [
        {
          ResourceType = "collection"
          Resource     = ["collection/\${var.project_name}-\${var.environment}"]
          Permission   = [
            "aoss:CreateCollectionItems",
            "aoss:UpdateCollectionItems",
            "aoss:DescribeCollectionItems",
            "aoss:DeleteCollectionItems",
          ]
        },
        {
          ResourceType = "index"
          Resource     = ["index/\${var.project_name}-\${var.environment}/*"]
          Permission   = [
            "aoss:CreateIndex",
            "aoss:UpdateIndex",
            "aoss:DescribeIndex",
            "aoss:DeleteIndex",
            "aoss:ReadDocument",
            "aoss:WriteDocument",
          ]
        }
      ]
      Principal = [data.aws_caller_identity.current.arn]
    }
  ])
}

data "aws_caller_identity" "current" {}

resource "aws_opensearchserverless_collection" "this" {
  name = "\${var.project_name}-\${var.environment}"
  type = "SEARCH"

  depends_on = [
    aws_opensearchserverless_security_policy.encryption,
    aws_opensearchserverless_security_policy.network,
    aws_opensearchserverless_access_policy.data,
  ]
}
`;

const OPENSEARCH_SERVERLESS_TF_OUTPUTS = `output "opensearch_collection_endpoint" {
  description = "OpenSearch Serverless collection endpoint"
  value       = aws_opensearchserverless_collection.this.collection_endpoint
}

output "opensearch_collection_arn" {
  description = "OpenSearch Serverless collection ARN"
  value       = aws_opensearchserverless_collection.this.arn
}
`;

// ---------------------------------------------------------------------------
// Terraform — OpenSearch Managed Cluster (Domain)
// ---------------------------------------------------------------------------

export const OPENSEARCH_MANAGED_TF = `resource "aws_opensearch_domain" "this" {
  domain_name    = "\${var.project_name}-\${var.environment}"
  engine_version = "OpenSearch_2.17"

  cluster_config {
    instance_type          = "r6g.large.search"
    instance_count         = 2
    zone_awareness_enabled = true

    zone_awareness_config {
      availability_zone_count = 2
    }
  }

  ebs_options {
    ebs_enabled = true
    volume_size = 20
    volume_type = "gp3"
  }

  vpc_options {
    subnet_ids         = slice(aws_subnet.private[*].id, 0, 2)
    security_group_ids = [aws_security_group.opensearch.id]
  }

  node_to_node_encryption {
    enabled = true
  }

  encrypt_at_rest {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-PFS-2023-10"
  }
}

resource "aws_security_group" "opensearch" {
  name_prefix = "\${var.project_name}-opensearch-"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
`;

export const OPENSEARCH_MANAGED_TF_OUTPUTS = `output "opensearch_domain_endpoint" {
  description = "OpenSearch domain endpoint"
  value       = aws_opensearch_domain.this.endpoint
}

output "opensearch_domain_arn" {
  description = "OpenSearch domain ARN"
  value       = aws_opensearch_domain.this.arn
}
`;

// ---------------------------------------------------------------------------
// Preset factory (default: serverless)
// ---------------------------------------------------------------------------

export function createOpenSearchPreset(): Preset {
  return {
    name: "opensearch",

    files: {},

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/opensearch.ts": OPENSEARCH_SERVERLESS_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { OpenSearchCollection } from "./constructs/opensearch";',
            constructs: '    new OpenSearchCollection(this, "OpenSearchCollection");',
          },
        },
      },
      terraform: {
        files: {
          "infra/opensearch.tf": OPENSEARCH_SERVERLESS_TF,
        },
        merge: {
          "infra/outputs.tf": OPENSEARCH_SERVERLESS_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon OpenSearch Serverless**: Serverless search and analytics collection",
        },
        {
          heading: "## Setup Checklist",
          content: "- [ ] **OpenSearch**: Design index mappings for your data",
        },
      ],
    },
  };
}
