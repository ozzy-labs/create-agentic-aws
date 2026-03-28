import type { Preset } from "../types.js";

const AURORA_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import type { Construct } from "constructs";

export interface AuroraClusterProps {
  readonly vpc: ec2.IVpc;
}

export class AuroraCluster extends Construct {
  public readonly cluster: rds.DatabaseCluster;

  constructor(scope: Construct, id: string, props: AuroraClusterProps) {
    super(scope, id);

    this.cluster = new rds.DatabaseCluster(this, "Cluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2("writer"),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromGeneratedSecret("clusteradmin"),
      defaultDatabaseName: "app",
      storageEncrypted: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, "ClusterEndpoint", {
      value: this.cluster.clusterEndpoint.hostname,
      description: "Aurora cluster endpoint",
    });

    new cdk.CfnOutput(this, "SecretArn", {
      value: this.cluster.secret?.secretArn ?? "",
      description: "Aurora credentials secret ARN",
    });
  }
}
`;

const AURORA_TF = `resource "aws_rds_cluster" "this" {
  cluster_identifier     = "\${var.project_name}-\${var.environment}-aurora"
  engine                 = "aurora-postgresql"
  engine_mode            = "provisioned"
  engine_version         = "16.4"
  database_name          = "app"
  master_username        = "clusteradmin"
  manage_master_user_password = true
  storage_encrypted      = true
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.aurora.id]
  skip_final_snapshot    = false
  final_snapshot_identifier = "\${var.project_name}-aurora-final"

  serverlessv2_scaling_configuration {
    min_capacity = 0.5
    max_capacity = 4
  }
}

resource "aws_rds_cluster_instance" "writer" {
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version
}

resource "aws_db_subnet_group" "this" {
  name       = "\${var.project_name}-\${var.environment}-aurora-subnet"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "\${var.project_name}-aurora-subnet-group"
  }
}

resource "aws_security_group" "aurora" {
  name_prefix = "\${var.project_name}-aurora-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
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

const AURORA_TF_OUTPUTS = `output "aurora_cluster_endpoint" {
  description = "Aurora cluster endpoint"
  value       = aws_rds_cluster.this.endpoint
}

output "aurora_cluster_reader_endpoint" {
  description = "Aurora cluster reader endpoint"
  value       = aws_rds_cluster.this.reader_endpoint
}

output "aurora_master_secret_arn" {
  description = "Aurora master user secret ARN"
  value       = aws_rds_cluster.this.master_user_secret[0].secret_arn
}
`;

export function createAuroraPreset(): Preset {
  return {
    name: "aurora",

    files: {},

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/aurora.ts": AURORA_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { AuroraCluster } from "./constructs/aurora";',
            constructs:
              '    // Note: pass vpc.vpc from Vpc construct\n    // new AuroraCluster(this, "AuroraCluster", { vpc: vpc.vpc });',
          },
        },
      },
      terraform: {
        files: {
          "infra/aurora.tf": AURORA_TF,
        },
        merge: {
          "infra/outputs.tf": AURORA_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content:
            "- **Amazon Aurora**: PostgreSQL-compatible serverless v2\n- **Secrets Manager**: Database credentials management",
        },
      ],
    },
  };
}
