---
description: 拡張子別リンター・フォーマッターのコマンド対応表と型チェックルール。他スキルから参照される。
user-invocable: false
---

# lint-rules - リンター・フォーマッターのコマンド対応表

## 拡張子別コマンド表

変更ファイルの拡張子に応じて、該当するリンター・フォーマッターを自動修正モードで実行する:

| 拡張子 / ファイル | 実行コマンド |
|--------|------------|
| `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.jsonc` | `biome check --write <files>` |
| `.sh` | `shellcheck <files>` → `shfmt -w <files>` |
| `.toml` | `taplo format <files>` |
| `.md` | `markdownlint-cli2 <files>` |
| `.yaml`, `.yml` | `yamlfmt <files>` → `yamllint -c .yamllint.yaml <files>` |
| `.github/workflows/*.yaml` | `actionlint` |

## 型チェック

- 変更ファイルに TypeScript/JavaScript を含む場合は `tsc --noEmit` も実行する

## セキュリティスキャン

- `gitleaks detect --no-banner` でシークレット検出を実行する

## 結果の扱い

**自動修正が適用された場合:**

- 修正されたファイルをユーザーに報告する
- 修正内容は既にワーキングツリーに反映されているため、そのまま次のステップに進む

**修正不可能なエラーの場合:**

- エラー内容をユーザーに報告する
- 呼び出し元のスキルを中断する
- **スキル自身がコードを修正しない**（リンター・フォーマッターによる自動修正は受け入れるが、型エラー等の修正判断はユーザーに委ねる）
