# 設計ドキュメント

## 概要

`create-agentic-aws` は AI エージェント対応の AWS プロジェクトを対話的なプリセットで生成する CLI ツール。

- **配布**: npm パッケージ (`pnpm create agentic-aws`)
- **プロンプトライブラリ**: @clack/prompts
- **アーキテクチャ**: Preset Composition — コンポーザブルプリセットを合成して最終プロジェクトを生成
- **フォーカス**: AWS インフラストラクチャ + AI エージェント設定（フロントエンド/バックエンドフレームワークは含まない）
- **派生元**: [create-agentic-dev](https://github.com/ozzy-3/create-agentic-dev)（独立リポジトリ、コード共有なし）
- **i18n**: 英語 + 日本語

## ウィザード選択

12 問 + サブオプション。エージェントファーストのフロー: AI エージェントを先に、その後インフラストラクチャ。

| # | 質問 | タイプ | 選択肢 |
|---|------|--------|--------|
| 1 | プロジェクト名 | テキスト入力 | — |
| 2 | AI エージェントツール | 複数選択 | Amazon Q / Claude Code / GitHub Copilot |
| 3 | Infrastructure as Code | 単一選択 | CDK / Terraform |
| 4 | コンピュート | 複数選択 | Lambda / ECS / EKS / EC2 |
| 5 | AI | 複数選択 | Bedrock / Bedrock Knowledge Bases / Bedrock Agents / OpenSearch |
| 6 | データ & ストレージ | 複数選択 | S3 / DynamoDB / Aurora / RDS |
| 7 | データパイプライン & 分析 | 複数選択 | Kinesis Data Streams / Glue / Redshift |
| 8 | アプリケーション統合 | 複数選択 | SQS / SNS / EventBridge / Step Functions |
| 9 | ネットワーク & API | 複数選択 | API Gateway / CloudFront |
| 10 | セキュリティ & アイデンティティ | 複数選択 | Cognito |
| 11 | オブザーバビリティ | 複数選択 | CloudWatch |
| 12 | 言語ツールチェーン | 複数選択 | TypeScript / Python（自動解決済みの言語は除外） |

### サブオプション（親の選択後に表示）

| 親 | サブオプション | 選択肢 |
|----|--------------|--------|
| ECS | 起動タイプ | Fargate / Managed Instances / EC2 |
| ECS | ロードバランサー | ALB / NLB / None |
| EKS | モード | Auto Mode / Fargate / Managed Node Group |
| EKS | ロードバランサー | ALB / NLB / None |
| EC2 | ロードバランサー | ALB / NLB / None |
| Lambda | VPC 配置 | Yes / No |
| Aurora | キャパシティ | Serverless v2 / Provisioned |
| Aurora | エンジン | MySQL 互換 / PostgreSQL 互換 |
| RDS | エンジン | MySQL / PostgreSQL |
| OpenSearch | モード | Serverless / Managed Cluster |
| Redshift | モード | Serverless / Provisioned |
| API Gateway | タイプ | REST API / HTTP API |

### 自動解決ルール

| 選択 | 自動解決 |
|------|---------|
| CDK | TypeScript（強制） |
| ECS / EKS / EC2 | VPC |
| Aurora / RDS | VPC（コンピュートで未解決の場合） |
| OpenSearch (Managed Cluster) / Redshift | VPC |
| Bedrock Knowledge Bases | Bedrock |
| Bedrock Agents | Bedrock、Bedrock Knowledge Bases |
| Glue | Python |

Language は IaC/Compute 選択で自動解決された言語を除外して表示する。全言語が自動解決済みならスキップする。

## プリセット

### プリセットレイヤー

| レイヤー | カテゴリ | 選択方法 | プリセット |
|---------|---------|---------|-----------|
| 0 | Base | 常に適用 | `base` |
| 1 | Agent | 複数選択 | `amazon-q`, `claude-code`, `copilot` |
| 2 | IaC | 単一選択 | `cdk`, `terraform` |
| 3 | Compute | 複数選択 | `lambda`, `ecs`, `eks`, `ec2` |
| 4 | AI | 複数選択 | `bedrock`, `bedrock-kb`, `bedrock-agents`, `opensearch` |
| 5 | Data & Storage | 複数選択 | `s3`, `dynamodb`, `aurora`, `rds` |
| 6 | Data Pipeline & Analytics | 複数選択 | `kinesis`, `glue`, `redshift` |
| 7 | Application Integration | 複数選択 | `sqs`, `sns`, `eventbridge`, `step-functions` |
| 8 | Networking & API | 複数選択 | `api-gateway`, `cloudfront` |
| 9 | Security & Identity | 複数選択 | `cognito` |
| 10 | Observability | 複数選択 | `cloudwatch` |
| 11 | Language (complement) | 複数選択 | `typescript`, `python` |
| — | Infrastructure (auto) | 自動解決 | `vpc` |

### インタラクションルール

- **同一レイヤー**: プリセットは独立して合成される（設計上競合なし）
- **レイヤー間依存**: プリセットの `requires` フィールドで依存プリセットを強制（例: CDK → TypeScript、Bedrock Agents → Bedrock KB → Bedrock）
- **自動解決**: Compute/DB/OpenSearch(Managed)/Redshift 選択で VPC を自動解決、CDK は TypeScript を強制、Glue は Python を強制
- **言語補完**: IaC/Compute で自動解決された言語は表示から除外。全て解決済みならスキップ
- **Agent プリセット**: Agent プリセットは `mcpServers` フィールドで MCP サーバーを定義する。Generator が全プリセットの MCP サーバーを収集し、各 Agent の設定ファイルに出力する。

### Service × IaC マトリクス

各 AWS サービスプリセットは **IaC 固有の貢献**を提供する。選択された IaC によって使用される貢献が決まる。

| | CDK (TypeScript) | Terraform |
|---|---|---|
| **Lambda** | Construct + handler.ts | .tf ファイル |
| **ECS** | Construct + Dockerfile | .tf ファイル |
| **EKS** | Construct + manifests | .tf ファイル |
| **EC2** | Construct | .tf ファイル |
| **VPC** | Construct | .tf ファイル |
| **S3** | Construct | .tf ファイル |
| **DynamoDB** | Construct + DAL | .tf ファイル |
| **Aurora** | Construct | .tf ファイル |
| **RDS** | Construct | .tf ファイル |
| **SQS** | Construct + consumer | .tf ファイル |
| **SNS** | Construct | .tf ファイル |
| **EventBridge** | Construct + schema | .tf ファイル |
| **Step Functions** | Construct + definition | .tf ファイル |
| **API Gateway** | Construct | .tf ファイル |
| **CloudFront** | Construct | .tf ファイル |
| **Cognito** | Construct | .tf ファイル |
| **CloudWatch** | Construct | .tf ファイル |
| **Bedrock** | Construct + SDK ボイラープレート | .tf ファイル |
| **Bedrock KB** | Construct | .tf ファイル |
| **Bedrock Agents** | Construct + Action Group ハンドラー | .tf ファイル |
| **OpenSearch** | Construct | .tf ファイル |
| **Kinesis** | Construct + consumer | .tf ファイル |
| **Glue** | Construct + PySpark ジョブスクリプト | .tf ファイル |
| **Redshift** | Construct | .tf ファイル |

### プリセット適用順序

```text
base → typescript → python → amazon-q → claude-code → copilot → cdk → terraform → vpc → lambda → ecs → eks → ec2 → bedrock → bedrock-kb → bedrock-agents → opensearch → s3 → dynamodb → aurora → rds → kinesis → glue → redshift → sqs → sns → eventbridge → step-functions → api-gateway → cloudfront → cognito → cloudwatch
```

### プリセットインターフェース

```typescript
interface Preset {
  name: string;
  requires?: string[];            // 依存プリセット（自動解決）
  files: Record<string, string>;  // 所有ファイル（パス → コンテンツ）
  merge: {                        // 共有ファイルへの貢献
    'package.json'?: DeepPartial<PackageJson>;
    '.mise.toml'?: DeepPartial<MiseConfig>;
    'lefthook.yaml'?: DeepPartial<LefthookConfig>;
    // ...
  };
  iacContributions?: {            // IaC 固有の貢献
    cdk?: {
      files: Record<string, string>;
      merge?: Record<string, unknown>;
    };
    terraform?: {
      files: Record<string, string>;
    };
  };
  markdown?: Record<string, MarkdownSection[]>;
  ciSteps?: CiContribution;
  setupExtra?: string;
}
```

### 常に含まれるもの (base)

| カテゴリ | 要素 | ファイル |
|---------|------|---------|
| Git | .gitignore, .gitattributes, EditorConfig, lefthook, commitlint, Gitleaks | `.gitignore`, `.gitattributes`, `.editorconfig`, `.commitlintrc.yaml` |
| パッケージ管理 | mise, pnpm | `.mise.toml`, `package.json`, `pnpm-lock.yaml`, `.npmrc` |
| AWS CLI | 常に含まれる（AWS 専用ツール） | `.mise.toml` (awscli) |
| AWS 認証情報マウント | 常に含まれる | `.devcontainer/devcontainer.json` (~/.aws マウント) |
| AWS MCP | 常に含まれる | `.mcp.json` (aws-iac) |
| Shell | shellcheck, shfmt | lefthook / CI 経由 |
| Markdown | markdownlint, mdformat | `.markdownlint-cli2.yaml`, `.mdformat.toml` |
| YAML | yamllint, yamlfmt | `.yamllint.yaml`, `.yamlfmt.yaml` |
| TOML | taplo | lefthook / CI 経由 |
| GitHub Actions | actionlint | lefthook / CI 経由 |
| Docker | devcontainer, hadolint, dockerfmt | `.devcontainer/`, `.hadolint.yaml`, `.dockerignore` |
| セキュリティ | Gitleaks | lefthook / CI 経由 |
| GitHub | CI ワークフロー, PR テンプレート, rulesets | `.github/` |
| VSCode | エディタ設定, 拡張機能（共通のみ） | `.vscode/` |
| MCP | `.mcp.json.example`（参照用） | `.mcp.json.example` |
| ドキュメント | README.md, CD セットアップガイド | `README.md`, `docs/` |
| スクリプト | setup, configure-repo, apply-rulesets | `scripts/` |
| Renovate | 依存関係自動更新 | `renovate.json` |

注: CD ワークフローは含まない。CI のみ（lint, typecheck, test, build）。ユーザーが環境に合わせて CD を追加する。CD セットアップガイドを `docs/` に提供。

### エージェント選択

**Amazon Q Developer** — 追加:

| 要素 | ファイル |
|------|---------|
| プロジェクトルール（インストラクションファイル） | `.amazonq/rules/project.md`（テンプレート + セクション注入） |
| MCP サーバー (Context7, Fetch) | エージェントの MCP 設定経由 |

**Claude Code** — 追加:

| 要素 | ファイル |
|------|---------|
| CLAUDE.md（インストラクションファイル） | `CLAUDE.md`（テンプレート + セクション注入） |
| Skills | `.claude/skills/` |
| Rules | `.claude/rules/git-workflow.md` |
| Settings | `.claude/settings.json`（パーミッション） |
| MCP サーバー (Context7, Fetch) | `.mcp.json`（mcpServers 経由） |
| devcontainer: Claude 認証情報マウント | `.devcontainer/devcontainer.json`（マージ） |
| .gitignore | `.claude/settings.local.json` |

**GitHub Copilot** — 追加:

| 要素 | ファイル |
|------|---------|
| Copilot インストラクション（インストラクションファイル） | `.github/copilot-instructions.md`（テンプレート + セクション注入） |
| MCP サーバー (Context7, Fetch) | エージェントの MCP 設定経由 |

### 言語選択

**TypeScript** — 追加:

| 要素 | ファイル |
|------|---------|
| Biome (lint + format) | `biome.json` |
| tsconfig | `tsconfig.json` |
| Node.js devDeps | `package.json` (devDependencies) |
| VSCode: Biome フォーマッター設定 | `.vscode/settings.json`（マージ） |
| VSCode: Biome 拡張機能 | `.vscode/extensions.json`（マージ） |
| devcontainer: Biome 拡張機能 | `.devcontainer/devcontainer.json`（マージ） |

**Python** — 追加:

| 要素 | ファイル |
|------|---------|
| Ruff (lint + format) | `pyproject.toml` |
| mypy (型チェック) | `pyproject.toml` |
| uv (パッケージマネージャー) | `uv.lock` |
| VSCode: Ruff/mypy/Python 設定 | `.vscode/settings.json`（マージ） |
| VSCode: Ruff, mypy, Python 拡張機能 | `.vscode/extensions.json`（マージ） |
| devcontainer: Python 拡張機能, uv-cache マウント | `.devcontainer/devcontainer.json`（マージ） |

### IaC 選択

**CDK** (TypeScript) — 追加:

| 要素 | ファイル |
|------|---------|
| CDK インフラストラクチャ | `infra/`（app エントリ, stack, constructs, test, cdk.json, config） |
| cfn-lint | `.cfnlintrc.yaml` |
| cdk-nag | `infra/`（依存関係） |
| VSCode: cdk.out 検索除外 | `.vscode/settings.json`（マージ） |
| VSCode: AWS Toolkit 拡張機能 | `.vscode/extensions.json`（マージ） |
| devcontainer: AWS Toolkit 拡張機能 | `.devcontainer/devcontainer.json`（マージ） |

```text
infra/
├── bin/app.ts                        # CDK App エントリ（共有: サービス imports マージ）
├── lib/
│   ├── app-stack.ts                  # メインスタック（共有: Construct インスタンス化マージ）
│   └── constructs/                   # 各サービスプリセットが所有
│       ├── lambda.ts                 # Lambda プリセット所有
│       ├── dynamodb.ts               # DynamoDB プリセット所有
│       └── ...
├── test/
│   └── app-stack.test.ts
├── cdk.json
├── tsconfig.json
└── package.json                      # 共有: サービス deps マージ
```

**Terraform** — 追加:

| 要素 | ファイル |
|------|---------|
| Terraform 設定 | `infra/`（各サービスプリセットが .tf ファイルを所有） |
| tflint (AWS plugin) | `.tflint.hcl` |
| terraform | mise 経由 |

```text
infra/
├── main.tf                           # Terraform プリセット所有（共有: provider, backend）
├── variables.tf                      # 共有: 各サービスが変数をマージ
├── outputs.tf                        # 共有: 各サービスが出力をマージ
├── lambda.tf                         # Lambda プリセット所有
├── dynamodb.tf                       # DynamoDB プリセット所有
├── vpc.tf                            # VPC プリセット所有
├── ...
├── terraform.tfvars.example
└── .tflint.hcl
```

### AWS サービスプリセット

各 AWS サービスプリセットが提供するもの:

1. **所有ファイル** — プリセット専用のトップレベルディレクトリ内のアプリコード（例: `lambda/`, `ecs/`）
2. **IaC 貢献** — Construct (CDK) または .tf ファイル (Terraform) を `infra/` に配置
3. **共有ファイル貢献** — `lib/`, `package.json` 等へのマージ

#### コンピュート

**Lambda** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| ハンドラーボイラープレート | Lambda プリセット（所有） | `lambda/handlers/` |
| Powertools 設定 | Lambda プリセット（所有） | `lambda/` |
| Lambda Construct | Lambda プリセット（所有） | `infra/lib/constructs/lambda.ts` (CDK) |
| Lambda .tf | Lambda プリセット（所有） | `infra/lambda.tf` (Terraform) |
| サブオプション: VPC 配置 | Lambda IaC に VPC 設定を追加 | |

**ECS** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| Dockerfile + app エントリ | ECS プリセット（所有） | `ecs/` |
| ECS Construct | ECS プリセット（所有） | `infra/lib/constructs/ecs.ts` (CDK) |
| ECS .tf | ECS プリセット（所有） | `infra/ecs.tf` (Terraform) |
| サブオプション: Fargate / Managed Instances / EC2 | IaC の起動タイプを決定 | |
| サブオプション: ALB / NLB / None | IaC に LB を追加 | |

**EKS** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| Dockerfile + app エントリ | EKS プリセット（所有） | `eks/` |
| Kubernetes マニフェスト | EKS プリセット（所有） | `eks/manifests/` |
| EKS Construct | EKS プリセット（所有） | `infra/lib/constructs/eks.ts` (CDK) |
| EKS .tf | EKS プリセット（所有） | `infra/eks.tf` (Terraform) |
| サブオプション: Auto Mode / Fargate / Managed Node Group | ノード設定を決定 | |
| サブオプション: ALB / NLB / None | IaC に LB を追加 | |

**EC2** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| ユーザーデータスクリプト | EC2 プリセット（所有） | `ec2/` |
| EC2 Construct | EC2 プリセット（所有） | `infra/lib/constructs/ec2.ts` (CDK) |
| EC2 .tf | EC2 プリセット（所有） | `infra/ec2.tf` (Terraform) |
| サブオプション: ALB / NLB / None | IaC に LB を追加 | |

#### インフラストラクチャ（自動解決）

**VPC** — ECS, EKS, EC2, Aurora, RDS が選択された場合に自動解決。ウィザードには表示されない。

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| VPC Construct | VPC プリセット（所有） | `infra/lib/constructs/vpc.ts` (CDK) |
| VPC .tf | VPC プリセット（所有） | `infra/vpc.tf` (Terraform) |

#### AI

**Bedrock** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| SDK 呼び出しボイラープレート | Bedrock プリセット（所有） | `lib/bedrock/` |
| IAM ポリシー（モデルアクセス） | Bedrock プリセット（所有） | `infra/`（Bedrock IaC 内） |
| Bedrock Construct / .tf | Bedrock プリセット（所有） | `infra/` |

**Bedrock Knowledge Bases** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| Knowledge Base Construct / .tf | Bedrock KB プリセット（所有） | `infra/` |
| データソース設定（S3） | Bedrock KB プリセット（所有） | `infra/`（KB IaC 内） |

**Bedrock Agents** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| Action Group Lambda ハンドラー | Bedrock Agents プリセット（所有） | `lambda/handlers/`（Lambda プリセットと共有ディレクトリ） |
| Agent 定義 Construct / .tf | Bedrock Agents プリセット（所有） | `infra/` |

**OpenSearch** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| Collection/Domain Construct / .tf | OpenSearch プリセット（所有） | `infra/` |
| 暗号化/ネットワーク/アクセスポリシー | OpenSearch プリセット（所有） | `infra/`（OpenSearch IaC 内） |
| サブオプション: Serverless / Managed Cluster | モードを決定（Managed Cluster は VPC 自動解決） | |

#### データ & ストレージ

**S3** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| Bucket Construct / .tf | S3 プリセット（所有） | `infra/` |

**DynamoDB** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| DAL ボイラープレート | DynamoDB プリセット（所有） | `lib/dynamodb/` |
| Table Construct / .tf | DynamoDB プリセット（所有） | `infra/` |

**Aurora** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| Cluster Construct / .tf | Aurora プリセット（所有） | `infra/` |
| Secrets Manager 統合 | Aurora プリセット（所有） | `infra/`（Aurora IaC 内） |
| サブオプション: Serverless v2 / Provisioned | キャパシティ設定を決定 | |
| サブオプション: MySQL / PostgreSQL 互換 | エンジンを決定 | |

**RDS** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| Instance Construct / .tf | RDS プリセット（所有） | `infra/` |
| Secrets Manager 統合 | RDS プリセット（所有） | `infra/`（RDS IaC 内） |
| サブオプション: MySQL / PostgreSQL | エンジンを決定 | |

#### データパイプライン & 分析

**Kinesis Data Streams** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| コンシューマーボイラープレート | Kinesis プリセット（所有） | `lib/kinesis/` |
| Stream Construct / .tf | Kinesis プリセット（所有） | `infra/` |

**Glue** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| PySpark ジョブスクリプト | Glue プリセット（所有） | `glue/jobs/` |
| Crawler / Database / Job 定義 | Glue プリセット（所有） | `infra/` |
| Glue Construct / .tf | Glue プリセット（所有） | `infra/` |

**Redshift** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| Namespace+Workgroup / Cluster Construct / .tf | Redshift プリセット（所有） | `infra/` |
| Secrets Manager 統合 | Redshift プリセット（所有） | `infra/`（Redshift IaC 内） |
| サブオプション: Serverless / Provisioned | モードを決定 | |

#### アプリケーション統合

**SQS** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| コンシューマーボイラープレート | SQS プリセット（所有） | `lib/sqs/` |
| Queue Construct / .tf | SQS プリセット（所有） | `infra/` |

**SNS** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| Topic Construct / .tf | SNS プリセット（所有） | `infra/` |

**EventBridge** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| イベントスキーマボイラープレート | EventBridge プリセット（所有） | `lib/eventbridge/` |
| Rule Construct / .tf | EventBridge プリセット（所有） | `infra/` |

**Step Functions** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| ステートマシン定義 | Step Functions プリセット（所有） | `lib/step-functions/` |
| State Machine Construct / .tf | Step Functions プリセット（所有） | `infra/` |

#### ネットワーク & API

**API Gateway** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| API Construct / .tf | API GW プリセット（所有） | `infra/` |
| サブオプション: REST API / HTTP API | API タイプを決定 | |

**CloudFront** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| Distribution Construct / .tf | CloudFront プリセット（所有） | `infra/` |

#### セキュリティ & アイデンティティ

**Cognito** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| User Pool Construct / .tf | Cognito プリセット（所有） | `infra/` |

#### オブザーバビリティ

**CloudWatch** — 追加:

| 要素 | オーナー | 配置場所 |
|------|---------|---------|
| Dashboard Construct / .tf | CloudWatch プリセット（所有） | `infra/` |
| Powertools 統合 | CloudWatch プリセット（所有） | `lib/observability/` |

## 依存チェーン

```text
CDK ────────────────────→ TypeScript（強制）
Lambda (handler) ───────→ TypeScript or Python（言語選択に基づく）
ECS ────────────────────→ VPC（自動解決）
EKS ────────────────────→ VPC（自動解決）
EC2 ────────────────────→ VPC（自動解決）
Aurora ─────────────────→ VPC（自動解決）
RDS ────────────────────→ VPC（自動解決）
Bedrock Agents ─────────→ Bedrock KB → Bedrock（自動解決）
Bedrock KB ─────────────→ Bedrock（自動解決）
OpenSearch (Managed) ───→ VPC（自動解決）
Glue ───────────────────→ Python（強制）
Redshift ───────────────→ VPC（自動解決）
```

## 生成プロジェクト構成

コンピュートベースのトップレベルディレクトリ。各コンピュートプリセットがディレクトリを所有。

```text
my-project/
├── infra/                    # IaC (CDK / Terraform)
├── lambda/                   # Lambda プリセット所有（Lambda 選択時）
│   └── handlers/
├── ecs/                      # ECS プリセット所有（ECS 選択時）
│   ├── Dockerfile
│   └── src/
├── eks/                      # EKS プリセット所有（EKS 選択時）
│   ├── Dockerfile
│   ├── src/
│   └── manifests/
├── ec2/                      # EC2 プリセット所有（EC2 選択時）
│   └── userdata.sh
├── glue/                     # Glue プリセット所有（Glue 選択時）
│   └── jobs/
├── lib/                      # 共有コード（マージ: DynamoDB DAL, SQS consumer 等）
├── tests/
├── scripts/
├── .devcontainer/
├── .github/
├── .vscode/
├── docs/
├── package.json
├── .mise.toml
├── README.md
└── ...
```

選択による構成の変化:

| 選択 | 生成構成 |
|------|---------|
| IaC のみ（サービスなし） | `infra/` のみ |
| Lambda | `infra/` + `lambda/` + `lib/` |
| ECS | `infra/` + `ecs/` + `lib/` |
| EKS | `infra/` + `eks/` + `lib/` |
| Lambda + ECS | `infra/` + `lambda/` + `ecs/` + `lib/` |
| DynamoDB（コンピュートなし） | `infra/` + `lib/`（DAL のみ） |
| Bedrock | `infra/` + `lib/`（SDK ボイラープレート） |
| Glue | `infra/` + `glue/`（PySpark ジョブ） |

### プリセットファイル所有権

| ファイル / ディレクトリ | オーナー | タイプ |
|----------------------|---------|--------|
| `lambda/` | Lambda プリセット | 所有 |
| `ecs/` | ECS プリセット | 所有 |
| `eks/` | EKS プリセット | 所有 |
| `ec2/` | EC2 プリセット | 所有 |
| `lib/bedrock/` | Bedrock プリセット | 所有 |
| `lib/dynamodb/` | DynamoDB プリセット | 所有 |
| `lib/kinesis/` | Kinesis プリセット | 所有 |
| `glue/` | Glue プリセット | 所有 |
| `lib/sqs/` | SQS プリセット | 所有 |
| `lib/eventbridge/` | EventBridge プリセット | 所有 |
| `lib/step-functions/` | Step Functions プリセット | 所有 |
| `lib/observability/` | CloudWatch プリセット | 所有 |
| `infra/lib/constructs/<service>.ts` | 各サービスプリセット | 所有 (CDK) |
| `infra/<service>.tf` | 各サービスプリセット | 所有 (Terraform) |
| `infra/lib/app-stack.ts` | CDK プリセット（ベース） | 共有（マージ） |
| `infra/main.tf` | Terraform プリセット（ベース） | 共有（マージ） |
| `infra/variables.tf` | Terraform プリセット（ベース） | 共有（マージ） |
| `infra/outputs.tf` | Terraform プリセット（ベース） | 共有（マージ） |
| `package.json` | base | 共有（マージ） |
| `.mise.toml` | base | 共有（マージ） |
| `CLAUDE.md` | Claude Code プリセット | 共有（マージ） |
| `README.md` | base | 共有（マージ） |

## プリセット合成

### 各プリセットが提供するもの

1. **所有ファイル** — プリセットが排他的に所有するファイル（そのままコピー、競合なし）
2. **マージ貢献** — 共有ファイルにマージする部分的な設定
3. **IaC 貢献** — IaC 固有の所有ファイル + IaC 共有ファイルへのマージ貢献

### 共有ファイル（複数プリセットが変更）

| 共有ファイル | 変更元 |
|-------------|-------|
| `package.json` | base, typescript, python, cdk, サービスプリセット（Bedrock 含む） |
| `.mise.toml` | base, typescript, python, cdk, terraform |
| `lefthook.yaml` | base, typescript, python, cdk |
| `.github/workflows/ci.yaml` | base, typescript, python, cdk, terraform |
| `.mcp.json` | base (aws-iac 常に含む) |
| `.vscode/settings.json` | typescript, python, cdk |
| `.vscode/extensions.json` | typescript, python, cdk, terraform |
| `.devcontainer/devcontainer.json` | base (aws), typescript, python, cdk |
| `infra/lib/app-stack.ts` | CDK プリセット + 全サービスプリセット（Construct imports） |
| `infra/main.tf` | Terraform プリセット (provider/backend のみ) |
| `infra/variables.tf` | Terraform プリセット + 全サービスプリセット |
| `infra/outputs.tf` | Terraform プリセット + 全サービスプリセット |
| `CLAUDE.md` | 全プリセット |
| `README.md` | 全プリセット |

### ファイルタイプ別マージ戦略

| ファイルタイプ | 戦略 |
|--------------|------|
| JSON (`package.json`, `.mcp.json`, `.vscode/*.json`, `devcontainer.json`) | Deep merge。配列: unique union |
| YAML (`lefthook.yaml`, `ci.yaml`) | Deep merge。配列: unique union |
| TOML (`.mise.toml`) | Deep merge |
| HCL (`.tf` 共有ファイル) | テンプレート + セクション注入 |
| Markdown (`CLAUDE.md`, `README.md`) | テンプレート + セクション注入 |

## テスト戦略

### 4 レイヤーテスト戦略

| レイヤー | 名前 | スコープ | 増加量 |
|---------|------|---------|-------|
| A1 | プリセットユニット | 各サービスプリセット × 代表 IaC 1 つ (CDK) | O(n) — サービスごとに 1 つ |
| A2 | IaC バリアント | 代表サービス × 両 IaC (CDK, Terraform) | O(1) — 固定 ~8 |
| B | ペアワイズ | 重要なサービス組み合わせ (Lambda + DynamoDB + API GW 等) | O(edges) — ~8 |
| C | スモーク | 代表的なアーキテクチャパターン | 固定 ~6 |

**レイヤー A1** — `tests/presets/*.test.ts`

各サービスプリセットを base + CDK で検証。所有ファイル、マージ貢献、IaC 貢献を確認。

**レイヤー A2** — `tests/iac-variants.test.ts`

代表サービス 3-4 個 (Lambda, ECS, DynamoDB, VPC) × 2 IaC (CDK, Terraform)。IaC 生成ロジックを検証。

**レイヤー B** — `tests/pairwise.test.ts`

重要なサービス組み合わせ:

- Lambda + DynamoDB + API Gateway（サーバーレス API）
- Lambda + SQS（非同期処理）
- ECS + Aurora + VPC（コンテナ + RDB）
- Lambda + ECS（ミックスコンピュート）
- TypeScript + Python（デュアル言語）

**レイヤー C** — `tests/smoke.test.ts` (= `pnpm run verify`)

| # | パターン | サービス |
|---|---------|---------|
| 1 | Base のみ | IaC のみ |
| 2 | サーバーレス API | Lambda + API GW + DynamoDB + S3 + CloudWatch |
| 3 | サーバーレスフル | Lambda + API GW + DynamoDB + S3 + SQS + CloudFront + Cognito + CloudWatch |
| 4 | コンテナ | ECS + Aurora + VPC + CloudWatch |
| 5 | Kubernetes | EKS + RDS + VPC + CloudWatch |
| 6 | フル構成 | Lambda + ECS + DynamoDB + S3 + SQS + API GW + CloudFront + Cognito + CloudWatch |

## リリースロードマップ

### バージョニング

Semantic Versioning。0.x.0 は破壊的変更を含む可能性あり。安定後に 1.0.0。

| 変更 | バージョンバンプ |
|------|----------------|
| バグ修正、テンプレート微調整 | パッチ (0.x.1) |
| 新サービスプリセット、エージェント追加、テンプレート改善 | マイナー (0.x.0) |
| ウィザード選択の変更、プリセットインターフェースの変更 | 0.x 中はメジャーまたはマイナー |

### 開発マイルストーン（内部、GitHub Milestones で管理）

| Milestone | 内容 | テーマ |
|-----------|------|-------|
| **M1** | GitHub 管理（Milestones, Labels, Project, Issue テンプレート, Branch rulesets）+ 開発環境（package.json, tsconfig, biome, lefthook, vitest, CI） | プロジェクト基盤 |
| **M2** | コアエンジン（types, merge, generator, CLI wizard, i18n）+ base プリセット + エージェント（Amazon Q, Claude Code, Copilot）+ 言語（TypeScript, Python）+ CI/setup ビルダー + テスト | コアエンジン |
| **M3** | CDK (TS) + Lambda, API GW, S3, DynamoDB, SQS, CloudFront, Cognito, CloudWatch（CDK テンプレート 8 個） | Serverless × CDK |
| **M4** | Terraform + M3 サービス（Terraform テンプレート +8 個） | Terraform 対応 |
| **M5** | ECS, EKS, EC2, VPC, Aurora, RDS × 両 IaC（テンプレート +12 個） | コンテナ/サーバー + RDB |
| **M6** | SNS, EventBridge, Step Functions × 両 IaC（テンプレート +6 個） | イベント駆動 |
| **M7** | リリース準備（テスト拡充、ドキュメント、npm パッケージング） | リリース準備 |
| **M8** | Bedrock, OpenSearch, Bedrock KB, Bedrock Agents × 両 IaC（テンプレート +8 個） | AI |
| **M9** | Kinesis Data Streams, Glue, Redshift × 両 IaC（テンプレート +6 個） | データパイプライン & 分析 |

合計: 48 テンプレート（24 サービス × 2 IaC）

M1〜M6 の間は npm リリースなし。M7 でリリース準備。M8〜M9 は v0.1.0 リリース後に着手。

### プロジェクト管理

| ツール | 役割 |
|-------|------|
| **GitHub Milestones** (M1–M6) | フェーズごとの Issue グルーピング。Milestone 単位の進捗管理。 |
| **GitHub Projects**（1 プロジェクト） | Milestone 横断のカンバンボード。ステータスと優先度の可視化。 |

プロジェクトビュー:

- **ボードビュー**: Todo → In Progress → Done（日次作業管理）
- **テーブルビュー**: Milestone でグループ化（全体進捗概要）

### ラベル

Issue は複数の軸でラベル分類:

| プレフィックス | 例 | 用途 |
|--------------|---|------|
| `type:` | `type:feat`, `type:fix`, `type:docs`, `type:test`, `type:refactor` | Issue タイプ |
| `preset:` | `preset:lambda`, `preset:ecs`, `preset:dynamodb`, `preset:cdk` | 関連プリセット |
| `iac:` | `iac:cdk`, `iac:terraform` | 関連 IaC |
| `milestone:` | `milestone:m1`, `milestone:m2`, ... | Milestone（GitHub Milestones のフィルタリング補助） |
| `priority:` | `priority:high`, `priority:medium`, `priority:low` | 優先度 |

### Issue テンプレート

`.github/ISSUE_TEMPLATE/` の標準化フォーム:

| テンプレート | 用途 |
|-------------|------|
| バグ報告 | 再現手順付きのバグ報告 |
| 機能リクエスト | 新機能や改善の提案 |

### ブランチ rulesets

`main` ブランチの保護ルール:

- Pull request 必須（直接プッシュ不可）
- CI チェック通過必須
- squash merge のみ

### npm リリース

| バージョン | タイミング | 内容 |
|-----------|----------|------|
| **v0.1.0** | M6 完了後 | 初回リリース。全 17 サービス × 2 IaC + 3 エージェント |
| v0.1.x | リリース後 | バグ修正、テンプレート改善 |
| **v0.2.0** | M8 完了後 | AI プリセット追加（Bedrock, Bedrock KB, Bedrock Agents, OpenSearch） |
| **v0.3.0** | M9 完了後 | データパイプライン & 分析プリセット追加（Kinesis, Glue, Redshift） |
| v0.x.0+ | 将来 | 新サービス、エージェント、機能 |
| **v1.0.0** | 安定後 | フィードバック期間を経て安定リリース |

### 配布

| 項目 | 値 |
|------|---|
| パッケージ名 | `create-agentic-aws` |
| レジストリ | npm public |
| 利用方法 | `pnpm create agentic-aws` / `npx create-agentic-aws` |
| リリーストリガー | GitHub Release (tag `v*`) → 自動パブリッシュ |
| Provenance | 有効（`--provenance`）サプライチェーンセキュリティ |
| リリース自動化 | release-please (Conventional Commits → Release PR → npm publish) |

### CI ワークフロー

**ci.yaml** — push / PR 時:

1. lint (Biome)
2. typecheck (tsc --noEmit)
3. test (vitest)
4. build (tsdown)

**release.yaml** — GitHub Release 公開時:

1. lint + typecheck + test + build
2. `npm publish --provenance --access public`

**release-please.yaml** — main へのプッシュ時:

1. Conventional Commits をパース → バージョンバンプ + CHANGELOG
2. Release PR を作成/更新
3. マージ時 → GitHub Release → release.yaml → npm publish

## 技術スタック（このツール自体）

| 項目 | 選択 |
|------|------|
| ランタイム | Node.js 24 (ESM) |
| パッケージマネージャー | pnpm 10 |
| バージョン管理 | mise (`.mise.toml`) |
| ビルド | tsdown (Rolldown ベース) |
| テスト | vitest |
| Lint/Format | Biome (TS/JS/JSON), shellcheck, shfmt, markdownlint-cli2, mdformat, yamlfmt, yamllint, taplo, actionlint |
| セキュリティ | Gitleaks |
| Git hooks | lefthook (commit-msg: commitlint, pre-commit: linters + gitleaks, pre-push: typecheck) |
| ウィザード UI | @clack/prompts |
| Deep merge | deepmerge-ts |
| YAML | yaml |
| TOML | smol-toml |
| ターミナルカラー | picocolors |

### 実行フロー

```text
pnpm create agentic-aws [my-app]
  │
  ├─ src/index.ts          # CLI 引数解析（--dry-run, --lang）、ロケール設定
  ├─ src/cli.ts            # @clack/prompts でウィザード実行（10 問 + サブオプション）
  │                          → WizardAnswers { projectName, agents, iac, compute, data, ... }
  ├─ src/generator.ts      # 1. 依存解決 → プリセットリスト（canonical order）
  │                          2. 所有ファイルを収集（テンプレート + インライン、変数置換）
  │                          3. IaC 貢献を収集（選択された IaC に基づく CDK/Terraform）
  │                          4. 共有ファイルを deep merge (JSON/YAML/TOML/HCL/TypeScript)
  │                          5. MCP サーバーを各エージェント設定に配布
  │                          6. Markdown テンプレートを展開（セクション注入）
  ├─ src/utils.ts          # GenerateResult → ディスク書き込み
  └─ src/tree.ts           # --dry-run 時のファイルツリー表示
```

### 依存パッケージ

| パッケージ | 用途 | タイプ |
|-----------|------|--------|
| `@clack/prompts` | ウィザード UI | dependencies |
| `deepmerge-ts` | Deep merge（TypeScript ファースト、型安全） | dependencies |
| `yaml` | YAML 読み書き（コメント保持ラウンドトリップ） | dependencies |
| `smol-toml` | TOML 読み書き（最速、TOML v1.1.0） | dependencies |
| `picocolors` | ターミナルカラー（最小・最速） | dependencies |
| `@biomejs/biome` | Linter / Formatter | devDependencies |
| `@commitlint/cli` | コミットメッセージ検証 | devDependencies |
| `@commitlint/config-conventional` | commitlint 設定 | devDependencies |
| `@types/node` | Node.js 型定義 | devDependencies |
| `tsdown` | ビルド（Rolldown ベース） | devDependencies |
| `typescript` | 型チェック | devDependencies |
| `vitest` | テスト | devDependencies |

引数パーサーは不要 — プロジェクト名は `process.argv[2]` のみ、`--dry-run` フラグ。

### CLI 機能

| 機能 | 説明 |
|------|------|
| `--dry-run` | ディスクに書き込まずに生成ファイルリストをプレビュー |
| 生成後自動セットアップ | 生成後に `pnpm install`, `git init` 等を自動実行 |
| 入力バリデーション | 依存チェーン（CDK → TS）、自動解決（VPC）、無効な組み合わせを検証 |

### package.json スケルトン

```json
{
  "name": "create-agentic-aws",
  "version": "0.0.0",
  "description": "CLI tool to generate AI-agent-native AWS projects — supports Amazon Q, Claude Code, Copilot, and more",
  "type": "module",
  "bin": {
    "create-agentic-aws": "./dist/index.mjs"
  },
  "files": [
    "dist",
    "templates"
  ],
  "engines": {
    "node": ">=22"
  }
}
```

`engines.node >= 22`: CLI ユーザーが Node 24 を持っていない可能性がある。生成プロジェクトは mise で Node 24 を指定。

### ソースコード構成

```text
create-agentic-aws/
├── src/
│   ├── index.ts              # エントリポイント（CLI 引数解析、ロケール設定）
│   ├── cli.ts                # ウィザード（@clack/prompts）
│   ├── generator.ts          # 合成エンジン（解決 → マージ → 出力）
│   ├── merge.ts              # ファイルタイプ別マージロジック（JSON, YAML, TOML, HCL, TS, Markdown）
│   ├── tree.ts               # ファイルツリー表示（--dry-run 用）
│   ├── utils.ts              # ファイル I/O ユーティリティ
│   ├── types.ts              # 型定義（Preset インターフェース等）
│   ├── i18n/
│   │   ├── index.ts
│   │   ├── en.ts
│   │   └── ja.ts
│   └── presets/
│       ├── registry.ts       # プリセットレジストリ（登録 + バリデーション）
│       ├── templates.ts      # テンプレートファイル読み込み
│       ├── shared.ts         # 共有 MCP サーバー定義
│       ├── base.ts
│       ├── typescript.ts
│       ├── python.ts
│       ├── amazon-q.ts
│       ├── claude-code.ts
│       ├── copilot.ts
│       ├── cdk.ts
│       ├── terraform.ts
│       ├── lambda.ts
│       ├── ecs.ts
│       ├── eks.ts
│       ├── ec2.ts
│       ├── vpc.ts
│       ├── bedrock.ts
│       ├── bedrock-kb.ts
│       ├── bedrock-agents.ts
│       ├── opensearch.ts
│       ├── s3.ts
│       ├── dynamodb.ts
│       ├── aurora.ts
│       ├── rds.ts
│       ├── kinesis.ts
│       ├── glue.ts
│       ├── redshift.ts
│       ├── sqs.ts
│       ├── sns.ts
│       ├── eventbridge.ts
│       ├── step-functions.ts
│       ├── api-gateway.ts
│       ├── cloudfront.ts
│       ├── cognito.ts
│       └── cloudwatch.ts
├── templates/                # 所有ファイル（プリセットがそのままコピー）
│   ├── base/                 # ※ IaC のみのプリセット（s3, aurora, rds, sns 等）は
│   ├── typescript/           #   テンプレートディレクトリを持たず、
│   ├── python/               #   src/presets/*.ts にインライン定義
│   ├── amazon-q/
│   ├── claude-code/
│   ├── copilot/
│   ├── cdk/
│   ├── terraform/
│   ├── lambda/
│   ├── bedrock/
│   ├── bedrock-agents/
│   ├── dynamodb/
│   ├── kinesis/
│   ├── glue/
│   ├── sqs/
│   ├── eventbridge/
│   ├── step-functions/
│   ├── cloudwatch/
│   ├── ecs/
│   ├── eks/
│   └── ec2/
├── tests/
├── docs/
├── scripts/
├── package.json
├── tsconfig.json
├── CLAUDE.md
├── README.md
└── LICENSE
```

## 将来の追加候補

| 項目 | カテゴリ | 備考 |
|------|---------|------|
| Codex CLI | Agent | 需要があれば追加 |
| Gemini CLI | Agent | 需要があれば追加 |
| Cline | Agent | 需要があれば追加 |
| Cursor | Agent | 需要があれば追加 |
| CDK (Python) | IaC | 需要があれば追加。CDK-TS がほとんどのケースをカバー |
| CloudFormation | IaC | 需要があれば追加。CDK が内部的に CFn テンプレートを生成 |
| AppSync | Networking & API | GraphQL API |
| ElastiCache | Data & Storage | Redis/Memcached |
| SageMaker | AI & ML | スコープが広すぎて1プリセットに収まらない。需要があれば再検討 |
| WAF | Security | Web アプリケーションファイアウォール |
