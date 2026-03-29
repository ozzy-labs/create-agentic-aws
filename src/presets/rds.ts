import type { Preset } from "../types.js";

const RDS_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import type { Construct } from "constructs";

export interface RdsInstanceProps {
  readonly vpc: ec2.IVpc;
}

export class RdsInstance extends Construct {
  public readonly instance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: RdsInstanceProps) {
    super(scope, id);

    this.instance = new rds.DatabaseInstance(this, "Instance", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromGeneratedSecret("dbadmin"),
      databaseName: "app",
      multiAz: false,
      storageEncrypted: true,
      publiclyAccessible: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      backupRetention: cdk.Duration.days(7),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, "InstanceEndpoint", {
      value: this.instance.instanceEndpoint.hostname,
      description: "RDS instance endpoint",
    });

    new cdk.CfnOutput(this, "SecretArn", {
      value: this.instance.secret?.secretArn ?? "",
      description: "RDS credentials secret ARN",
    });
  }
}
`;

const RDS_TF = `resource "aws_db_instance" "this" {
  identifier     = "\${var.project_name}-\${var.environment}-rds"
  engine         = "postgres"
  engine_version = "16.4"
  instance_class = "db.t4g.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true

  db_name  = "app"
  username = "dbadmin"
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az            = false
  publicly_accessible = false
  skip_final_snapshot = false
  final_snapshot_identifier = "\${var.project_name}-rds-final"
  backup_retention_period   = 7
}

resource "aws_db_subnet_group" "rds" {
  name       = "\${var.project_name}-\${var.environment}-rds-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "\${var.project_name}-rds-subnet-group"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "\${var.project_name}-rds-"
  vpc_id      = aws_vpc.this.id

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

const RDS_TF_OUTPUTS = `output "rds_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.this.endpoint
}

output "rds_master_secret_arn" {
  description = "RDS master user secret ARN"
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}
`;

export function createRdsPreset(): Preset {
  return {
    name: "rds",
    requires: ["vpc"],

    files: {},

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/rds.ts": RDS_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { RdsInstance } from "./constructs/rds";',
            constructs: '    new RdsInstance(this, "RdsInstance", { vpc: vpc.vpc });',
          },
        },
      },
      terraform: {
        files: {
          "infra/rds.tf": RDS_TF,
        },
        merge: {
          "infra/outputs.tf": RDS_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content:
            "- **Amazon RDS**: PostgreSQL relational database\n- **Secrets Manager**: Database credentials management",
        },
      ],
    },
  };
}
