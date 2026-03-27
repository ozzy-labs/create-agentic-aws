---
description: lint・テスト・コミット・PR 作成を一括実行する
disable-model-invocation: true
allowed-tools: Bash, Read, Grep, Glob, AskUserQuestion
---

# ship - lint・テスト・コミット・PR を一括実行

変更に対して lint → テスト → コミット → PR 作成を順に実行する統合パイプライン。

いずれかのステップで失敗した場合は中断し、エラー内容を報告する。

**重要:** 各ステップの SKILL.md を Read して**ワークフロー手順のみ**を実行する。読み込んだ SKILL.md 内の「次のアクション提案」セクションは**すべて無視**する。

## ワークフロー

### Step 1: lint

`.claude/skills/lint/SKILL.md` を Read し、その手順に従って全リンター・フォーマッターを実行する。

**失敗した場合:** エラー内容を報告し、修正→再度 `/ship` を提案して中断する。

### Step 2: test

`.claude/skills/test/SKILL.md` を Read し、その手順に従って全テストを実行する。

**失敗した場合:** 失敗内容を報告し、修正→再度 `/ship` を提案して中断する。

### Step 3: commit

`.claude/skills/commit/SKILL.md` を Read し、ステージング＆コミットの手順に従う（「次のアクション提案」セクションは無視する）。

**変更がない場合:** 既にコミット済みの未プッシュコミットがあれば Step 4 に進む。なければ終了する。

### Step 4: pr

以下の手順でプッシュ＆PR 作成を行う:

1. `git branch --show-current` で現在のブランチを確認する
2. `git push -u origin <branch>` でリモートにプッシュする
3. `gh pr view` で既存 PR を確認する
   - **既存 PR がない場合:** `gh pr create --title "<タイトル>" --body "<本文>"` で PR を作成する。タイトルは直近のコミットメッセージの 1 行目を使用する
   - **既存 PR がある場合:** プッシュのみ（PR は自動更新される）
4. PR の URL を記録する

### Step 5: 完了報告

実行結果をまとめて報告する:

```text
完了:
  コミット: abc1234 feat: 認証機能を追加
  ブランチ: feat/add-auth
  PR: https://github.com/owner/repo/pull/123
```

### Step 6: 次のアクション確認

AskUserQuestion を呼び出し、以下の選択肢を表示する:

- **「PR をレビューする」** → `.claude/skills/review/SKILL.md` を Read し、その手順に従う
- **「PR をマージする」** → `gh pr merge --squash --delete-branch` でマージを実行し、結果を報告する
