#!/usr/bin/env bash
# Wrapper for record-live.js — rights-cleared sources only.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/record-live.js" "$@"
