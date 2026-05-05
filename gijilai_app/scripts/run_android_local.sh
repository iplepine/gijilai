#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PORT="${ANDROID_EMULATOR_PORT:-5554}"
SERIAL="${ANDROID_SERIAL:-emulator-${PORT}}"
WEB_PORT="${GIJILAI_WEB_PORT:-3000}"
HOST_WEB_URL="${GIJILAI_HOST_WEB_URL:-http://127.0.0.1:${WEB_PORT}/}"
WEBVIEW_URL="${GIJILAI_WEB_URL:-http://10.0.2.2:${WEB_PORT}/}"
GOOGLE_WEB_CLIENT_ID="${GOOGLE_WEB_CLIENT_ID:-247682708380-ibd5vrskhud6dhqf3jca9v9hp1dadad0.apps.googleusercontent.com}"
GOOGLE_IOS_CLIENT_ID="${GOOGLE_IOS_CLIENT_ID:-247682708380-fhagldmd4r7s32efqp466ifc8prk8u6k.apps.googleusercontent.com}"

"${SCRIPT_DIR}/start_stable_android_emulator.sh"

if command -v curl >/dev/null 2>&1; then
  if ! curl -fsS "${HOST_WEB_URL}" >/dev/null; then
    echo "Warning: local web server did not respond at ${HOST_WEB_URL}" >&2
    echo "Start it from ../app with: npm run dev -- --port ${WEB_PORT}" >&2
  fi
fi

cd "${APP_DIR}"

exec flutter run \
  -d "${SERIAL}" \
  --dart-define=GIJILAI_WEB_URL="${WEBVIEW_URL}" \
  --dart-define=GOOGLE_WEB_CLIENT_ID="${GOOGLE_WEB_CLIENT_ID}" \
  --dart-define=GOOGLE_IOS_CLIENT_ID="${GOOGLE_IOS_CLIENT_ID}"
