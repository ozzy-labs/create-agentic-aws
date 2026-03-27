#!/usr/bin/env bash
set -euo pipefail

# Configure GitHub repository settings via gh CLI.
# Run once after creating the repository.

REPO="${1:?Usage: $0 <owner/repo>}"

echo "==> Configuring repository: ${REPO}"

gh repo edit "${REPO}" \
  --delete-branch-on-merge \
  --enable-squash-merge \
  --disable-merge-commit \
  --disable-rebase-merge

echo "==> Repository configured."
echo "    Run scripts/apply-rulesets.sh to set up branch protection."
