#!/bin/zsh
set -e
cd -- "$(dirname -- "$0")"
DYC_NODE='/Users/bigwolf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
if [ ! -x "$DYC_NODE" ]; then
  DYC_NODE="$(command -v node)"
fi
"$DYC_NODE" scripts/run-framework.mjs build
"$DYC_NODE" scripts/local-workspace.mjs
