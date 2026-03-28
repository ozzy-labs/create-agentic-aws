export const en = {
  // CLI intro
  intro: "Create an AI-agent-native AWS project",
  outro: "Project created successfully!",
  outroNext: "Next steps:",
  outroNextCd: "  cd {{projectName}}",
  outroNextMiseTrust: "  mise trust",
  outroNextMiseInstall: "  mise install",
  outroNextPnpmInstall: "  pnpm install",
  outroNextGitInit: '  git init && git add -A && git commit -m "init"',

  // Wizard questions
  projectName: "Project name",
  projectNamePlaceholder: "my-aws-project",
  agents: "AI agent tools",
  agentsHint: "Select all that apply",
  iac: "Infrastructure as Code",
  compute: "Compute",
  computeHint: "Select all that apply",
  ai: "AI",
  aiHint: "Select all that apply",

  data: "Data & Storage",
  dataHint: "Select all that apply",
  integration: "Application Integration",
  integrationHint: "Select all that apply",
  networking: "Networking & API",
  networkingHint: "Select all that apply",
  security: "Security & Identity",
  securityHint: "Select all that apply",
  observability: "Observability",
  observabilityHint: "Select all that apply",
  languages: "Language toolchain",
  languagesHint: "Select additional languages",

  // Wizard choices — Agents
  "agent.amazon-q": "Amazon Q Developer",
  "agent.claude-code": "Claude Code",
  "agent.copilot": "GitHub Copilot",

  // Wizard choices — IaC
  "iac.cdk": "AWS CDK (TypeScript)",
  "iac.terraform": "Terraform",

  // Wizard choices — Compute
  "compute.lambda": "Lambda",
  "compute.ecs": "ECS",
  "compute.eks": "EKS",
  "compute.ec2": "EC2",

  // Wizard choices — AI
  "ai.bedrock": "Bedrock",
  "ai.opensearch": "OpenSearch",

  // Wizard choices — Data
  "data.s3": "S3",
  "data.dynamodb": "DynamoDB",
  "data.aurora": "Aurora",
  "data.rds": "RDS",

  // Wizard choices — Integration
  "integration.sqs": "SQS",
  "integration.sns": "SNS",
  "integration.eventbridge": "EventBridge",
  "integration.step-functions": "Step Functions",

  // Wizard choices — Networking
  "networking.api-gateway": "API Gateway",
  "networking.cloudfront": "CloudFront",

  // Wizard choices — Security
  "security.cognito": "Cognito",

  // Wizard choices — Observability
  "observability.cloudwatch": "CloudWatch",

  // Wizard choices — Languages
  "language.typescript": "TypeScript",
  "language.python": "Python",

  // Sub-options — ECS
  "ecs.launchType": "ECS launch type",
  "ecs.launchType.fargate": "Fargate",
  "ecs.launchType.managed-instances": "Managed Instances",
  "ecs.launchType.ec2": "EC2",
  "ecs.loadBalancer": "ECS load balancer",

  // Sub-options — EKS
  "eks.mode": "EKS mode",
  "eks.mode.auto-mode": "Auto Mode",
  "eks.mode.fargate": "Fargate",
  "eks.mode.managed-node-group": "Managed Node Group",
  "eks.loadBalancer": "EKS load balancer",

  // Sub-options — EC2
  "ec2.loadBalancer": "EC2 load balancer",

  // Sub-options — Load balancer (shared)
  "lb.alb": "ALB",
  "lb.nlb": "NLB",
  "lb.none": "None",

  // Sub-options — Lambda
  "lambda.vpcPlacement": "Place Lambda in VPC?",
  yes: "Yes",
  no: "No",

  // Sub-options — Aurora
  "aurora.capacity": "Aurora capacity",
  "aurora.capacity.serverless-v2": "Serverless v2",
  "aurora.capacity.provisioned": "Provisioned",
  "aurora.engine": "Aurora engine",
  "aurora.engine.mysql": "MySQL compatible",
  "aurora.engine.postgresql": "PostgreSQL compatible",

  // Sub-options — RDS
  "rds.engine": "RDS engine",
  "rds.engine.mysql": "MySQL",
  "rds.engine.postgresql": "PostgreSQL",

  // Sub-options — OpenSearch
  "opensearch.mode": "OpenSearch mode",
  "opensearch.mode.serverless": "Serverless",
  "opensearch.mode.managed-cluster": "Managed Cluster",

  // Sub-options — API Gateway
  "apiGateway.type": "API Gateway type",
  "apiGateway.type.rest": "REST API",
  "apiGateway.type.http": "HTTP API",

  // Auto-resolution messages
  autoResolvedVpc: "VPC auto-resolved (required by {{service}})",
  autoResolvedTypescript: "TypeScript auto-resolved (required by CDK)",
  skippedLanguages: "Language selection skipped (all resolved)",

  // Errors
  cancelled: "Operation cancelled.",
} as const;

export type MessageKey = keyof typeof en;
