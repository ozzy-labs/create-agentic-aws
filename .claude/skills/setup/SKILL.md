---
description: 開発環境のフルセットアップを行う
disable-model-invocation: true
allowed-tools: Bash, AskUserQuestion
---

# setup - 開発環境のセットアップ

開発環境をゼロからセットアップする。

## 手順

1. `mise trust && mise install` で全ツールをインストール
2. `pnpm install` で Node.js 依存関係をインストール（Git フックも自動設定）
3. 各ステップの状態を報告し、**同じレスポンス内で** AskUserQuestion を呼び出す（`answers` パラメータは設定しない）。報告の出力だけでスキルを終了しない:
   - **「実装を開始する」** → `.claude/skills/implement/SKILL.md` を Read し、その手順に従う
   - **「lint を実行する」** → `.claude/skills/lint/SKILL.md` を Read し、その手順に従う
