import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

const EKS_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as eks from "aws-cdk-lib/aws-eks";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

export interface EksClusterProps {
  readonly vpc: ec2.IVpc;
}

export class EksCluster extends Construct {
  public readonly cluster: eks.Cluster;

  constructor(scope: Construct, id: string, props: EksClusterProps) {
    super(scope, id);

    this.cluster = new eks.Cluster(this, "Cluster", {
      vpc: props.vpc,
      version: eks.KubernetesVersion.V1_31,
      defaultCapacity: 2,
      defaultCapacityInstance: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM,
      ),
      clusterLogging: [
        eks.ClusterLoggingTypes.API,
        eks.ClusterLoggingTypes.AUDIT,
        eks.ClusterLoggingTypes.CONTROLLER_MANAGER,
      ],
    });

    new cdk.CfnOutput(this, "ClusterName", {
      value: this.cluster.clusterName,
      description: "EKS cluster name",
    });

    new cdk.CfnOutput(this, "ClusterEndpoint", {
      value: this.cluster.clusterEndpoint,
      description: "EKS cluster API endpoint",
    });
  }
}
`;

const EKS_TF = `resource "aws_eks_cluster" "this" {
  name     = "\${var.project_name}-\${var.environment}-cluster"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.31"

  vpc_config {
    subnet_ids = var.private_subnet_ids
  }

  enabled_cluster_log_types = ["api", "audit", "controllerManager"]

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster,
    aws_iam_role_policy_attachment.eks_service,
  ]
}

resource "aws_eks_node_group" "this" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "\${var.project_name}-\${var.environment}-nodes"
  node_role_arn   = aws_iam_role.eks_node.arn
  subnet_ids      = var.private_subnet_ids

  instance_types = ["t3.medium"]

  scaling_config {
    desired_size = 2
    max_size     = 4
    min_size     = 1
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node,
    aws_iam_role_policy_attachment.eks_cni,
    aws_iam_role_policy_attachment.eks_ecr,
  ]
}

resource "aws_iam_role" "eks_cluster" {
  name = "\${var.project_name}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role_policy_attachment" "eks_service" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
}

resource "aws_iam_role" "eks_node" {
  name = "\${var.project_name}-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_worker_node" {
  role       = aws_iam_role.eks_node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "eks_cni" {
  role       = aws_iam_role.eks_node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "eks_ecr" {
  role       = aws_iam_role.eks_node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}
`;

const EKS_TF_VARS = `variable "eks_node_instance_type" {
  description = "EKS node group instance type"
  type        = string
  default     = "t3.medium"
}
`;

const EKS_TF_OUTPUTS = `output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.this.name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = aws_eks_cluster.this.endpoint
}
`;

export function createEksPreset(): Preset {
  const templates = readTemplates("eks");

  return {
    name: "eks",

    files: {
      ...templates,
    },

    merge: {
      ".devcontainer/devcontainer.json": {
        customizations: {
          vscode: {
            extensions: ["exiasr.hadolint"],
          },
        },
      },
      ".vscode/extensions.json": {
        recommendations: ["exiasr.hadolint"],
      },
      "lefthook.yaml": {
        "pre-push": {
          commands: {
            "typecheck-eks": {
              run: "cd eks && npx tsc --noEmit",
            },
          },
        },
      },
    },

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/eks.ts": EKS_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { EksCluster } from "./constructs/eks";',
            constructs: '    new EksCluster(this, "EksCluster", { vpc: vpc.vpc });',
          },
        },
      },
      terraform: {
        files: {
          "infra/eks.tf": EKS_TF,
        },
        merge: {
          "infra/variables.tf": EKS_TF_VARS,
          "infra/outputs.tf": EKS_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content: "- **Amazon EKS**: Kubernetes orchestration\n- **Docker**: Container runtime",
        },
      ],
    },
  };
}
