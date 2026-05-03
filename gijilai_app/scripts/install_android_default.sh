#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PORT="${ANDROID_EMULATOR_PORT:-5554}"
SERIAL="${ANDROID_SERIAL:-emulator-${PORT}}"
ANDROID_STUDIO_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
APK_PATH="${APP_DIR}/build/app/outputs/flutter-apk/app-debug.apk"
PACKAGE_NAME="com.devho.gijilai"
ACTIVITY_NAME=".MainActivity"

if [[ -z "${JAVA_HOME:-}" && -x "${ANDROID_STUDIO_JBR}/bin/java" ]]; then
  export JAVA_HOME="${ANDROID_STUDIO_JBR}"
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

cd "${APP_DIR}"

flutter build apk --debug

adb -s "${SERIAL}" install -r "${APK_PATH}"
adb -s "${SERIAL}" shell am start -n "${PACKAGE_NAME}/${ACTIVITY_NAME}"
