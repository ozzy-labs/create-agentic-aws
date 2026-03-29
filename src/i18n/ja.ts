import type { MessageKey } from "./en.js";

export const ja: Record<MessageKey, string> = {
  // CLI intro
  intro: "AI エージェント対応の AWS プロジェクトを作成",
  outro: "プロジェクトを作成しました！",
  outroNext: "次のステップ:",
  outroNextCd: "  cd {{projectName}}",
  outroNextMiseTrust: "  mise trust",
  outroNextMiseInstall: "  mise install",
  outroNextPnpmInstall: "  pnpm install",
  outroNextGitInit: '  git init && git add -A && git commit -m "init"',
  directoryExists: "ディレクトリ {{path}} は既に存在します。上書きしますか？",
  cancelled: "操作がキャンセルされました。",

  // Wizard questions
  projectName: "プロジェクト名",
  projectNamePlaceholder: "my-aws-project",
  validationRequired: "必須項目です",
  validationMaxLength: "100 文字以内で入力してください",
  validationProjectNameFormat:
    "小文字英数字で始まり、小文字英数字・ドット・ハイフン・アンダースコアのみ使用可能です",
  agents: "AI エージェントツール",
  iac: "Infrastructure as Code",
  compute: "コンピュート",
  ai: "AI",
  data: "データ & ストレージ",
  dataPipeline: "データパイプライン & 分析",
  integration: "アプリケーション統合",
  networking: "ネットワーク & API",
  security: "セキュリティ & アイデンティティ",
  observability: "オブザーバビリティ",
  languages: "言語ツールチェーン",

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
  "ai.bedrock-kb": "Bedrock Knowledge Bases",
  "ai.bedrock-agents": "Bedrock Agents",
  "ai.opensearch": "OpenSearch",

  // Wizard choices — Data
  "data.s3": "S3",
  "data.dynamodb": "DynamoDB",
  "data.aurora": "Aurora",
  "data.rds": "RDS",

  // Wizard choices — Data Pipeline
  "dataPipeline.kinesis": "Kinesis Data Streams",
  "dataPipeline.glue": "Glue",
  "dataPipeline.redshift": "Redshift",

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
  "ecs.launchType": "ECS 起動タイプ",
  "ecs.launchType.fargate": "Fargate",
  "ecs.launchType.managed-instances": "Managed Instances",
  "ecs.launchType.ec2": "EC2",
  "ecs.loadBalancer": "ECS ロードバランサー",

  // Sub-options — EKS
  "eks.mode": "EKS モード",
  "eks.mode.auto-mode": "Auto Mode",
  "eks.mode.fargate": "Fargate",
  "eks.mode.managed-node-group": "Managed Node Group",
  "eks.loadBalancer": "EKS ロードバランサー",

  // Sub-options — EC2
  "ec2.loadBalancer": "EC2 ロードバランサー",

  // Sub-options — Load balancer (shared)
  "lb.alb": "ALB",
  "lb.nlb": "NLB",
  "lb.none": "なし",

  // Sub-options — Lambda
  "lambda.vpcPlacement": "Lambda を VPC に配置しますか？",
  yes: "はい",
  no: "いいえ",

  // Sub-options — Aurora
  "aurora.capacity": "Aurora キャパシティ",
  "aurora.capacity.serverless-v2": "Serverless v2",
  "aurora.capacity.provisioned": "Provisioned",
  "aurora.engine": "Aurora エンジン",
  "aurora.engine.mysql": "MySQL 互換",
  "aurora.engine.postgresql": "PostgreSQL 互換",

  // Sub-options — RDS
  "rds.engine": "RDS エンジン",
  "rds.engine.mysql": "MySQL",
  "rds.engine.postgresql": "PostgreSQL",

  // Sub-options — Redshift
  "redshift.mode": "Redshift モード",
  "redshift.mode.serverless": "Serverless",
  "redshift.mode.provisioned": "Provisioned",

  // Sub-options — OpenSearch
  "opensearch.mode": "OpenSearch モード",
  "opensearch.mode.serverless": "Serverless",
  "opensearch.mode.managed-cluster": "Managed Cluster",

  // Sub-options — API Gateway
  "apiGateway.type": "API Gateway タイプ",
  "apiGateway.type.rest": "REST API",
  "apiGateway.type.http": "HTTP API",

  // Auto-resolution messages
  autoResolvedVpc: "VPC を自動追加しました（{{service}} が必要とするため）",
  autoResolvedTypescript: "TypeScript を自動追加しました（CDK が必要とするため）",
  skippedLanguages: "言語選択をスキップしました（全て解決済み）",

  // Dry-run
  dryRunFiles: "生成されるファイル（dry-run）",
  dryRunResources: "作成される AWS リソース",
};
