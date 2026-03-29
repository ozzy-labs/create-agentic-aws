import type { Preset } from "../types.js";
import { readTemplates } from "./templates.js";

const ECS_CONSTRUCT = `import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import type { Construct } from "constructs";

export interface EcsServiceProps {
  readonly vpc: ec2.IVpc;
}

export class EcsService extends Construct {
  public readonly cluster: ecs.Cluster;
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: EcsServiceProps) {
    super(scope, id);

    this.cluster = new ecs.Cluster(this, "Cluster", {
      vpc: props.vpc,
      containerInsights: true,
    });

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      "Service",
      {
        cluster: this.cluster,
        cpu: 256,
        memoryLimitMiB: 512,
        desiredCount: 1,
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset("../ecs"),
          containerPort: 3000,
          environment: {
            NODE_ENV: "production",
          },
        },
        publicLoadBalancer: true,
        circuitBreaker: { rollback: true },
      },
    );

    this.service = fargateService.service;

    fargateService.targetGroup.configureHealthCheck({
      path: "/health",
    });

    new cdk.CfnOutput(this, "ServiceUrl", {
      value: \`http://\${fargateService.loadBalancer.loadBalancerDnsName}\`,
      description: "ECS service URL",
    });
  }
}
`;

const ECS_TF = `resource "aws_ecs_cluster" "this" {
  name = "\${var.project_name}-\${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "this" {
  family                   = "\${var.project_name}-\${var.environment}-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_cpu
  memory                   = var.ecs_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name      = "app"
    image     = "node:24-slim"
    essential = true
    readonlyRootFilesystem = true
    user                   = "1000:1000"
    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]
    environment = [
      { name = "NODE_ENV", value = "production" }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/\${var.project_name}"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_lb" "ecs" {
  name               = "\${var.project_name}-\${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.ecs_alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "ecs" {
  name        = "\${var.project_name}-\${var.environment}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
}

resource "aws_lb_listener" "ecs" {
  load_balancer_arn = aws_lb.ecs.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs.arn
  }
}

resource "aws_ecs_service" "this" {
  name            = "\${var.project_name}-\${var.environment}-service"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ecs.arn
    container_name   = "app"
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.ecs]
}

resource "aws_security_group" "ecs_alb" {
  name_prefix = "\${var.project_name}-ecs-alb-"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name_prefix = "\${var.project_name}-ecs-"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role" "ecs_execution" {
  name = "\${var.project_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/\${var.project_name}"
  retention_in_days = 30
}
`;

const ECS_TF_VARS = `variable "ecs_cpu" {
  description = "CPU units for ECS task"
  type        = number
  default     = 256
}

variable "ecs_memory" {
  description = "Memory (MiB) for ECS task"
  type        = number
  default     = 512
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}
`;

const ECS_TF_OUTPUTS = `output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.this.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.this.name
}

output "ecs_alb_dns_name" {
  description = "ECS ALB DNS name"
  value       = aws_lb.ecs.dns_name
}
`;

export function createEcsPreset(): Preset {
  const templates = readTemplates("ecs");

  return {
    name: "ecs",
    requires: ["vpc"],

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
        "pre-commit": {
          commands: {
            hadolint: {
              glob: "**/Dockerfile*",
              run: "hadolint {staged_files}",
            },
          },
        },
        "pre-push": {
          commands: {
            "typecheck-ecs": {
              run: "cd ecs && npx tsc --noEmit",
            },
          },
        },
      },
    },

    iacContributions: {
      cdk: {
        files: {
          "infra/lib/constructs/ecs.ts": ECS_CONSTRUCT,
        },
        merge: {
          "infra/lib/app-stack.ts": {
            imports: 'import { EcsService } from "./constructs/ecs";',
            constructs: '    new EcsService(this, "EcsService", { vpc: vpc.vpc });',
          },
        },
      },
      terraform: {
        files: {
          "infra/ecs.tf": ECS_TF,
        },
        merge: {
          "infra/variables.tf": ECS_TF_VARS,
          "infra/outputs.tf": ECS_TF_OUTPUTS,
        },
      },
    },

    markdown: {
      "README.md": [
        {
          heading: "## Tech Stack",
          content:
            "- **Amazon ECS**: Container orchestration (Fargate)\n- **Docker**: Container runtime",
        },
        {
          heading: "## Setup Checklist",
          content: "- [ ] **ECS**: Run `pnpm install` before Docker build (lock file required)",
        },
      ],
    },
  };
}
