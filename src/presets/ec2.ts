import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

const EC2_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Construct } from "constructs";

export interface Ec2InstanceProps {
  readonly vpc: ec2.IVpc;
}

export class Ec2Instance extends Construct {
  public readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props: Ec2InstanceProps) {
    super(scope, id);

    const role = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy"),
      ],
    });

    const securityGroup = new ec2.SecurityGroup(this, "SG", {
      vpc: props.vpc,
      description: "EC2 instance security group",
      allowAllOutbound: true,
    });
    // NEXT: Add ingress rules for your use case.
    // Example: securityGroup.addIngressRule(ec2.Peer.ipv4('10.0.0.0/16'), ec2.Port.tcp(80), 'HTTP from VPC');

    this.instance = new ec2.Instance(this, "Instance", {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      role,
      securityGroup,
      userData: ec2.UserData.custom(
        readFileSync(join(__dirname, "..", "..", "..", "ec2", "userdata.sh"), "utf-8"),
      ),
    });

    new cdk.CfnOutput(this, "InstanceId", {
      value: this.instance.instanceId,
      description: "EC2 instance ID",
    });
  }
}
`;

const EC2_TF = `resource "aws_instance" "this" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.ec2_instance_type
  subnet_id              = aws_subnet.private[0].id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  user_data              = file("\${path.module}/../ec2/userdata.sh")

  tags = {
    Name = "\${var.project_name}-\${var.environment}-instance"
  }
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_security_group" "ec2" {
  name_prefix = "\${var.project_name}-ec2-"
  vpc_id      = aws_vpc.this.id

  # NEXT: Add ingress rules for your use case.
  # ingress {
  #   from_port   = 80
  #   to_port     = 80
  #   protocol    = "tcp"
  #   cidr_blocks = [var.vpc_cidr]
  # }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role" "ec2" {
  name = "\${var.project_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "ec2_cloudwatch" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_instance_profile" "ec2" {
  name = "\${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2.name
}
`;

const EC2_TF_VARS = `variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}
`;

const EC2_TF_OUTPUTS = `output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.this.id
}
`;

export function createEc2Preset(): Preset {
  const templates = readTemplates("ec2");

  return {
    name: "ec2",
    requires: ["vpc"],

    files: {
      ...templates,
    },

    merge: {},

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/ec2.ts": EC2_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { Ec2Instance } from "./constructs/ec2";',
            constructs: '    new Ec2Instance(this, "Ec2Instance", { vpc: vpc.vpc });',
          },
        },
      },
      terraform: {
        files: {
          "infra/ec2.tf": EC2_TF,
        },
        merge: {
          "infra/variables.tf": EC2_TF_VARS,
          "infra/outputs.tf": EC2_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content:
            "- **Amazon EC2**: Virtual server (Amazon Linux 2023)\n- **SSM**: Session Manager for secure access",
        },
      ],
    },
  };
}
