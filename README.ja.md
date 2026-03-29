# create-agentic-aws

[English](README.md)

AI エージェント対応の AWS プロジェクトを生成する CLI ツール — Amazon Q、Claude Code、Copilot などをサポート

## クイックスタート

```bash
pnpm create agentic-aws my-app
cd my-app
bash scripts/setup.sh
```

## ウィザード

対話式ウィザードが 12 の質問をエージェントファーストの順序で行います:

1. **プロジェクト名**
2. **AI エージェントツール** — Amazon Q / Claude Code / GitHub Copilot（複数選択）
3. **Infrastructure as Code** — CDK / Terraform
4. **コンピュート** — Lambda / ECS / EKS / EC2（複数選択）
5. **AI** — Bedrock / Bedrock Knowledge Bases / Bedrock Agents / OpenSearch（複数選択）
6. **データ & ストレージ** — S3 / DynamoDB / Aurora / RDS（複数選択）
7. **データパイプライン & 分析** — Kinesis / Glue / Redshift（複数選択）
8. **アプリケーション統合** — SQS / SNS / EventBridge / Step Functions（複数選択）
9. **ネットワーク & API** — API Gateway / CloudFront（複数選択）
10. **セキュリティ & アイデンティティ** — Cognito（複数選択）
11. **オブザーバビリティ** — CloudWatch（複数選択）
12. **言語ツールチェーン** — TypeScript / Python（自動解決済みを除外）

サブオプション（ECS 起動タイプ、Aurora エンジン、API Gateway タイプなど）は親の選択後に表示されます。

## プリセット

13 レイヤーにまたがるコンポーザブルプリセット。各プリセットは所有ファイル + IaC 貢献 + 共有ファイルへのマージ貢献を提供します。

| レイヤー | プリセット |
|---------|----------|
| Base | 常に含まれる（AWS CLI、git hooks、linters、devcontainer） |
| Agent | Amazon Q, Claude Code, GitHub Copilot |
| IaC | CDK (TypeScript), Terraform |
| Compute | Lambda, ECS, EKS, EC2 |
| Data & Storage | S3, DynamoDB, Aurora, RDS |
| Application Integration | SQS, SNS, EventBridge, Step Functions |
| Networking & API | API Gateway, CloudFront |
| Security & Identity | Cognito |
| Observability | CloudWatch |
| Language | TypeScript, Python |
| Infrastructure (auto) | VPC（コンピュート/DB 選択で自動解決） |

### Service x IaC マトリクス

各 AWS サービスプリセットは IaC 固有の貢献を提供します。CDK は Construct を生成し、Terraform は .tf ファイルを生成します。合計: 17 サービス x 2 IaC = 34 テンプレート。

詳細は [docs/design.md](docs/design.md) を参照してください。

## 生成されるもの

すべての生成プロジェクトに含まれるもの:

- **AI エージェント統合** — インストラクションファイル、MCP サーバー、スキル（Claude Code）、エージェントごとのルール
- **AWS インフラストラクチャ** — 選択したサービスの CDK Construct または Terraform 設定
- **Git hooks** — commitlint (commit-msg)、linters + Gitleaks (pre-commit)、typecheck (pre-push)
- **CI ワークフロー** — 全 linter + テスト + ビルド（push/PR 時）
- **Dev Container** — AWS CLI、プリセット固有ツール、拡張機能、~/.aws マウント付き VSCode devcontainer
- **Renovate** — 依存関係の自動更新

### 生成プロジェクト構成

```text
my-project/
├── infra/          # IaC (CDK Construct または Terraform .tf ファイル)
├── lambda/         # Lambda ハンドラー（選択時）
├── ecs/            # ECS Dockerfile + アプリ（選択時）
├── eks/            # EKS Dockerfile + アプリ + K8s マニフェスト（選択時）
├── ec2/            # EC2 ユーザーデータ（選択時）
├── lib/            # 共有コード（DAL、コンシューマー、スキーマ）
├── tests/
├── scripts/
├── .devcontainer/
├── .github/
├── .vscode/
└── ...
```

## 開発

```bash
pnpm install          # 依存関係インストール
pnpm run dev          # ウォッチモードビルド
pnpm run build        # プロダクションビルド
pnpm test             # テスト実行
pnpm run lint:all     # 全 linter + typecheck
pnpm run verify       # 生成出力の検証
```

### ロードマップ

開発は [GitHub Milestones](https://github.com/ozzy-labs/create-agentic-aws/milestones) と [GitHub Projects](https://github.com/orgs/ozzy-labs/projects) で管理しています。

| Milestone | テーマ |
|-----------|-------|
| M1 | プロジェクト基盤（GitHub 管理 + 開発環境 + CI） |
| M2 | コアエンジン、base プリセット、ウィザード、エージェント、言語、i18n |
| M3 | CDK + サーバーレスサービス (Lambda, API GW, S3, DynamoDB, SQS, CloudFront, Cognito, CloudWatch) |
| M4 | M3 サービスの Terraform 対応 |
| M5 | コンテナ/サーバー + RDB (ECS, EKS, EC2, VPC, Aurora, RDS) |
| M6 | イベント駆動 (SNS, EventBridge, Step Functions) |

## アーキテクチャ

- `src/presets/*.ts` — プリセットロジック（マージ貢献、IaC 貢献、依存関係）
- `templates/*/` — プリセットのファイルアセット（そのまま出力にコピー）
- `src/generator.ts` — 合成エンジン（解決 → マージ → 出力）
- `src/merge.ts` — ファイルタイプ別マージロジック（JSON, YAML, TOML, HCL, Markdown）

詳細は [docs/design.md](docs/design.md) を参照してください。

## ライセンス

MIT
