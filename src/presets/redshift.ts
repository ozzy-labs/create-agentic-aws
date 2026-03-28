import type { Preset } from "../types.js";

// ---------------------------------------------------------------------------
// CDK Construct — Redshift Serverless (default)
// ---------------------------------------------------------------------------

const REDSHIFT_SERVERLESS_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as redshiftserverless from "aws-cdk-lib/aws-redshiftserverless";
import type { Construct } from "constructs";

export interface RedshiftServerlessProps {
  readonly vpc: ec2.IVpc;
}

export class RedshiftServerless extends Construct {
  public readonly namespace: redshiftserverless.CfnNamespace;
  public readonly workgroup: redshiftserverless.CfnWorkgroup;

  constructor(scope: Construct, id: string, props: RedshiftServerlessProps) {
    super(scope, id);

    this.namespace = new redshiftserverless.CfnNamespace(this, "Namespace", {
      namespaceName: cdk.Names.uniqueId(this).toLowerCase().slice(0, 28) + "-ns",
      adminUsername: "admin",
      manageAdminPassword: true,
      dbName: "app",
    });

    this.workgroup = new redshiftserverless.CfnWorkgroup(this, "Workgroup", {
      workgroupName: cdk.Names.uniqueId(this).toLowerCase().slice(0, 28) + "-wg",
      namespaceName: this.namespace.namespaceName,
      baseCapacity: 32,
      subnetIds: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
      securityGroupIds: [],
      publiclyAccessible: false,
    });

    this.workgroup.addDependency(this.namespace);

    new cdk.CfnOutput(this, "WorkgroupEndpoint", {
      value: this.workgroup.attrWorkgroupEndpointAddress,
      description: "Redshift Serverless workgroup endpoint",
    });

    new cdk.CfnOutput(this, "NamespaceName", {
      value: this.namespace.namespaceName,
      description: "Redshift Serverless namespace name",
    });
  }
}
`;

// ---------------------------------------------------------------------------
// CDK Construct — Redshift Provisioned Cluster
// ---------------------------------------------------------------------------

export const REDSHIFT_PROVISIONED_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as redshift from "aws-cdk-lib/aws-redshift";
import type { Construct } from "constructs";

export interface RedshiftClusterProps {
  readonly vpc: ec2.IVpc;
}

export class RedshiftCluster extends Construct {
  public readonly cluster: redshift.CfnCluster;

  constructor(scope: Construct, id: string, props: RedshiftClusterProps) {
    super(scope, id);

    const subnetGroup = new redshift.CfnClusterSubnetGroup(this, "SubnetGroup", {
      description: "Redshift cluster subnet group",
      subnetIds: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
    });

    this.cluster = new redshift.CfnCluster(this, "Cluster", {
      clusterType: "multi-node",
      nodeType: "ra3.xlplus",
      numberOfNodes: 2,
      dbName: "app",
      masterUsername: "admin",
      manageMasterPassword: true,
      clusterSubnetGroupName: subnetGroup.ref,
      publiclyAccessible: false,
      encrypted: true,
    });

    new cdk.CfnOutput(this, "ClusterEndpoint", {
      value: this.cluster.attrEndpointAddress,
      description: "Redshift cluster endpoint",
    });

    new cdk.CfnOutput(this, "ClusterPort", {
      value: this.cluster.attrEndpointPort,
      description: "Redshift cluster port",
    });
  }
}
`;

// ---------------------------------------------------------------------------
// Terraform — Redshift Serverless (default)
// ---------------------------------------------------------------------------

const REDSHIFT_SERVERLESS_TF = `resource "aws_redshiftserverless_namespace" "this" {
  namespace_name      = "\${var.project_name}-\${var.environment}-ns"
  admin_username      = "admin"
  manage_admin_password = true
  db_name             = "app"
}

resource "aws_redshiftserverless_workgroup" "this" {
  namespace_name     = aws_redshiftserverless_namespace.this.namespace_name
  workgroup_name     = "\${var.project_name}-\${var.environment}-wg"
  base_capacity      = 32
  subnet_ids         = aws_subnet.private[*].id
  security_group_ids = [aws_security_group.redshift.id]
  publicly_accessible = false
}

resource "aws_security_group" "redshift" {
  name_prefix = "\${var.project_name}-redshift-"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port   = 5439
    to_port     = 5439
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

const REDSHIFT_SERVERLESS_TF_OUTPUTS = `output "redshift_workgroup_endpoint" {
  description = "Redshift Serverless workgroup endpoint"
  value       = aws_redshiftserverless_workgroup.this.endpoint[0].address
}

output "redshift_namespace_name" {
  description = "Redshift Serverless namespace name"
  value       = aws_redshiftserverless_namespace.this.namespace_name
}
`;

// ---------------------------------------------------------------------------
// Terraform — Redshift Provisioned Cluster
// ---------------------------------------------------------------------------

export const REDSHIFT_PROVISIONED_TF = `resource "aws_redshift_subnet_group" "this" {
  name       = "\${var.project_name}-\${var.environment}-redshift"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "\${var.project_name}-redshift-subnet-group"
  }
}

resource "aws_security_group" "redshift" {
  name_prefix = "\${var.project_name}-redshift-"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port   = 5439
    to_port     = 5439
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

resource "aws_redshift_cluster" "this" {
  cluster_identifier        = "\${var.project_name}-\${var.environment}"
  node_type                 = "ra3.xlplus"
  number_of_nodes           = 2
  database_name             = "app"
  master_username           = "admin"
  manage_master_password    = true
  cluster_subnet_group_name = aws_redshift_subnet_group.this.name
  vpc_security_group_ids    = [aws_security_group.redshift.id]
  publicly_accessible       = false
  encrypted                 = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "\${var.project_name}-redshift-final"
}
`;

export const REDSHIFT_PROVISIONED_TF_OUTPUTS = `output "redshift_cluster_endpoint" {
  description = "Redshift cluster endpoint"
  value       = aws_redshift_cluster.this.endpoint
}

output "redshift_cluster_id" {
  description = "Redshift cluster identifier"
  value       = aws_redshift_cluster.this.cluster_identifier
}
`;

// ---------------------------------------------------------------------------
// Preset factory (default: serverless)
// ---------------------------------------------------------------------------

export function createRedshiftPreset(): Preset {
  return {
    name: "redshift",

    files: {},

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/redshift.ts": REDSHIFT_SERVERLESS_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { RedshiftServerless } from "./constructs/redshift";',
            constructs: '    new RedshiftServerless(this, "RedshiftServerless", { vpc: vpc.vpc });',
          },
        },
      },
      terraform: {
        files: {
          "infra/redshift.tf": REDSHIFT_SERVERLESS_TF,
        },
        merge: {
          "infra/outputs.tf": REDSHIFT_SERVERLESS_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon Redshift**: Serverless data warehouse (namespace + workgroup)",
        },
      ],
    },
  };
}
