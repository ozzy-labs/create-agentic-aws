#!/usr/bin/env bash
set -euo pipefail

# Apply branch rulesets to the GitHub repository.
# Requires gh CLI with admin permissions.

REPO="${1:?Usage: $0 <owner/repo>}"

echo "==> Applying branch rulesets to: ${REPO}"

gh api "repos/${REPO}/rulesets" \
  --method POST \
  --input - <<'JSON'
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "pull_request", "parameters": { "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": true, "require_last_push_approval": false } },
    { "type": "required_status_checks", "parameters": { "strict_required_status_checks_policy": false, "required_status_checks": [{ "context": "ci" }] } }
  ]
}
JSON

echo "==> Rulesets applied."
