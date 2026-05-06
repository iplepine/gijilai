#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PORT="${ANDROID_EMULATOR_PORT:-5554}"
SERIAL="${ANDROID_SERIAL:-emulator-${PORT}}"
ANDROID_STUDIO_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
BUILD_MODE="${ANDROID_BUILD_MODE:-debug}"
FORCE_REINSTALL="${ANDROID_FORCE_REINSTALL:-0}"
APK_PATH="${APP_DIR}/build/app/outputs/flutter-apk/app-${BUILD_MODE}.apk"
PACKAGE_NAME="com.devho.gijilai"
ACTIVITY_NAME=".MainActivity"
GOOGLE_WEB_CLIENT_ID="${GOOGLE_WEB_CLIENT_ID:-247682708380-ibd5vrskhud6dhqf3jca9v9hp1dadad0.apps.googleusercontent.com}"
GOOGLE_IOS_CLIENT_ID="${GOOGLE_IOS_CLIENT_ID:-247682708380-fhagldmd4r7s32efqp466ifc8prk8u6k.apps.googleusercontent.com}"

case "${BUILD_MODE}" in
  debug | profile | release) ;;
  *)
    echo "ANDROID_BUILD_MODE must be debug, profile, or release." >&2
    exit 64
    ;;
esac

if [[ -z "${JAVA_HOME:-}" && -x "${ANDROID_STUDIO_JBR}/bin/java" ]]; then
  export JAVA_HOME="${ANDROID_STUDIO_JBR}"
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

cd "${APP_DIR}"

if [[ "${BUILD_MODE}" == "debug" ]]; then
  echo "Building debug APK. Google native login requires this debug signing SHA in Firebase/Google Cloud." >&2
  echo "For upload/release-key auth smoke, run with ANDROID_BUILD_MODE=release." >&2
fi

flutter build apk \
  "--${BUILD_MODE}" \
  --dart-define=GOOGLE_WEB_CLIENT_ID="${GOOGLE_WEB_CLIENT_ID}" \
  --dart-define=GOOGLE_IOS_CLIENT_ID="${GOOGLE_IOS_CLIENT_ID}"

install_output="$(adb -s "${SERIAL}" install -r "${APK_PATH}" 2>&1)" || {
  if [[ "${install_output}" == *"INSTALL_FAILED_UPDATE_INCOMPATIBLE"* && "${FORCE_REINSTALL}" == "1" ]]; then
    printf '%s\n' "${install_output}" >&2
    echo "Existing app has a different signing certificate; uninstalling because ANDROID_FORCE_REINSTALL=1." >&2
    adb -s "${SERIAL}" uninstall "${PACKAGE_NAME}"
    adb -s "${SERIAL}" install "${APK_PATH}"
  else
    printf '%s\n' "${install_output}" >&2
    if [[ "${install_output}" == *"INSTALL_FAILED_UPDATE_INCOMPATIBLE"* ]]; then
      echo "Set ANDROID_FORCE_REINSTALL=1 to uninstall the existing app and install this signing variant." >&2
    fi
    exit 1
  fi
}

adb -s "${SERIAL}" shell am start -n "${PACKAGE_NAME}/${ACTIVITY_NAME}"
