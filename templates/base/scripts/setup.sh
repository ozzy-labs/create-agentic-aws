#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies..."
pnpm install

echo "==> Setting up git hooks..."
pnpm run prepare

echo "==> Setup complete!"
