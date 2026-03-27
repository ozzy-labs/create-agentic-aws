# CLAUDE.md

## プロジェクト概要

`create-agentic-aws`: AI エージェント対応の AWS プロジェクトを対話的に生成する CLI ツール。[create-agentic-dev](https://github.com/ozzy-3/create-agentic-dev) から派生。

## 技術スタック

- **ランタイム**: Node.js 24 (ESM)
- **パッケージマネージャー**: pnpm 10
- **バージョン管理**: mise (`.mise.toml`)
- **ビルド**: tsdown (Rolldown ベース)
- **テスト**: vitest
- **Lint/Format**:
  - Biome (TS/JS/JSON)
  - shellcheck + shfmt (Shell)
  - markdownlint-cli2 + mdformat (Markdown)
  - yamlfmt + yamllint (YAML)
  - taplo (TOML)
  - actionlint (GitHub Actions)
- **セキュリティ**: Gitleaks (シークレット検出)
- **Git hooks**: lefthook (commit-msg: commitlint, pre-commit: linters + gitleaks, pre-push: typecheck)

## プロジェクト構成

```text
src/              -> CLI ソースコード
src/presets/      -> プリセットロジック（マージ貢献、IaC 貢献、依存関係）
templates/        -> プリセットのファイルアセット（そのまま出力にコピー）
tests/            -> テストファイル
docs/             -> 設計ドキュメント、ガイド
scripts/          -> シェルスクリプト
```

## 主要コマンド

```bash
# 開発
pnpm install               # 依存関係インストール
pnpm run dev               # ウォッチモードビルド
pnpm run build             # プロダクションビルド
pnpm test                  # テスト実行
pnpm run test:watch        # ウォッチモードテスト
pnpm run verify            # 生成出力の検証（コミット前に必須）

# Lint & Format
pnpm run lint              # Biome チェック
pnpm run lint:fix          # Biome チェック（自動修正付き）
pnpm run lint:all          # 全 linter + typecheck + gitleaks
pnpm run typecheck         # TypeScript 型チェック
pnpm run lint:md           # Markdown lint
pnpm run lint:yaml         # YAML lint
pnpm run lint:shell        # Shell lint
pnpm run lint:toml         # TOML フォーマットチェック
pnpm run lint:secrets      # シークレット検出 (Gitleaks)
```

## コーディング規約

- TypeScript: ESM (`"type": "module"`)、strict mode、NodeNext モジュール解決
- 型のみのインポートには `import type` を使用（verbatimModuleSyntax 有効）
- インデント: 2 スペース (TS/JS/JSON/YAML)
- 改行コード: LF のみ
- 最大行幅: 100 (Biome)
- コミット前に `pnpm run lint:all` を通すこと
- Shell: shellcheck と shfmt を通すこと
- YAML ファイル拡張子: `.yaml`（ツールが `.yml` を要求する場合は許容）

## 検証（必須）

コード変更後、ユーザーに完了を報告する前に以下のチェックを**必ず**通すこと:

1. `pnpm run build` — ビルド成功
2. `pnpm test` — 全テスト通過（verify 含む）
3. `pnpm run typecheck` — 型チェック通過

エラーが出た場合はその場で修正し、全て通過してから報告する。

`pnpm run verify` は生成出力の検証テストのみを実行する。全プリセット組み合わせで JSON 妥当性、プリセット分離、共有ファイル（VSCode、devcontainer、package.json）の正しい合成、IaC 貢献、拡張子の一貫性を検証する。

## アーキテクチャ

- **Preset Composition**: 各プリセットは所有ファイル + IaC 貢献 + 共有ファイルへのマージ貢献を提供
- **Service × IaC マトリクス**: 各 AWS サービスプリセットが CDK Construct と Terraform .tf ファイルを提供
- **マージ戦略**: JSON/YAML deep merge、TOML deep merge、HCL テンプレート + セクション注入、Markdown テンプレート + セクション注入
- **依存チェーン**: CDK → TypeScript 強制、ECS/EKS/EC2/Aurora/RDS → VPC 自動解決
- **ファイル所有権**: 所有ファイルを最大化、共有ファイルを最小化
- 詳細は `docs/design.md` を参照

## プロジェクト管理

- **GitHub Milestones** (M1–M6): Issue をフェーズごとにグルーピング。各 Milestone の定義は `docs/design.md` を参照。
- **GitHub Projects**: 全 Milestone の Issue を横断管理するカンバンボード。
- **Labels**: `type:`, `preset:`, `iac:`, `priority:` プレフィックスで分類。
- **Issue テンプレート**: バグ報告 / 機能リクエストの 2 種。
- **Branch rulesets**: `main` は PR 必須、CI 通過必須、squash merge のみ。
- Issue 作成時は必ず対応する Milestone に紐づけ、適切な Labels を付与する。
- PR は関連 Issue を `Closes #N` で参照する。

## コミット規約

Conventional Commits 必須（commitlint で強制）:

```text
<type>[optional scope]: <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

## ブランチ戦略

GitHub Flow: `main` + feature branches。**squash merge のみ**。
ブランチ命名: `<type>/<short-description>`（例: `feat/add-wizard`, `fix/merge-bug`）

## Skills

- `/setup` - 開発環境セットアップ
- `/implement` - Issue または指示に基づく実装
- `/lint` - 全 linter を自動修正付きで実行
- `/test` - 全テスト実行
- `/commit` - ステージングとコミット
- `/pr` - プッシュと PR 作成/更新
- `/review` - コードレビュー
- `/ship` - lint + test + commit + PR を一括実行
- `/drive` - implement + ship + review ループ（エンドツーエンド）
