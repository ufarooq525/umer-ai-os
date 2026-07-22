#!/usr/bin/env bash
set -euo pipefail
cp -n .env.example .env 2>/dev/null || true
pnpm install
pnpm build
echo "Skeleton ready. Start infra: pnpm dev:infra"
