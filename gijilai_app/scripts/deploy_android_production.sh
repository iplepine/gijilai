#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${APP_DIR}"

if bundle exec fastlane --version >/dev/null 2>&1; then
  exec bundle exec fastlane android release_production
else
  exec fastlane android release_production
fi
