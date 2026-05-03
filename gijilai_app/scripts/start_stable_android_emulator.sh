#!/usr/bin/env bash

set -euo pipefail

AVD_NAME="${AVD_NAME:-small_phone}"
PORT="${ANDROID_EMULATOR_PORT:-5554}"
SERIAL="${ANDROID_SERIAL:-emulator-${PORT}}"
GPU_MODE="${ANDROID_EMULATOR_GPU:-swiftshader}"
DEVICE_LOCALE="${ANDROID_DEVICE_LOCALE:-ko-KR}"
BOOT_TIMEOUT_SECONDS="${ANDROID_EMULATOR_BOOT_TIMEOUT_SECONDS:-180}"

resolve_sdk_dir() {
  if [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then
    printf '%s\n' "${ANDROID_SDK_ROOT}"
    return
  fi

  if [[ -n "${ANDROID_HOME:-}" ]]; then
    printf '%s\n' "${ANDROID_HOME}"
    return
  fi

  if command -v android >/dev/null 2>&1; then
    android info sdk
    return
  fi

  printf '%s\n' "${HOME}/Library/Android/sdk"
}

SDK_DIR="$(resolve_sdk_dir)"
EMULATOR_BIN="${EMULATOR_BIN:-${SDK_DIR}/emulator/emulator}"
ADB_BIN="${ADB_BIN:-${SDK_DIR}/platform-tools/adb}"
AVD_DIR="${HOME}/.android/avd/${AVD_NAME}.avd"
RUNNING_DIR="${HOME}/Library/Caches/TemporaryItems/avd/running"
LOG_DIR="${TMPDIR:-/tmp}"
LOG_FILE="${LOG_DIR%/}/gijilai-${AVD_NAME}-emulator.log"
LAUNCH_LOG_FILE="${LOG_DIR%/}/gijilai-${AVD_NAME}-emulator-launch.log"

if [[ ! -x "${EMULATOR_BIN}" ]]; then
  echo "Android emulator binary not found: ${EMULATOR_BIN}" >&2
  exit 1
fi

if [[ ! -x "${ADB_BIN}" ]]; then
  echo "adb binary not found: ${ADB_BIN}" >&2
  exit 1
fi

if [[ ! -d "${AVD_DIR}" ]]; then
  echo "AVD not found: ${AVD_NAME} (${AVD_DIR})" >&2
  exit 1
fi

device_state() {
  "${ADB_BIN}" devices | awk -v serial="${SERIAL}" '$1 == serial { print $2 }'
}

set_device_locale() {
  if [[ -n "${DEVICE_LOCALE}" ]]; then
    "${ADB_BIN}" -s "${SERIAL}" shell cmd locale set-device-locale "${DEVICE_LOCALE}" >/dev/null 2>&1 || true
  fi
}

cleanup_stale_locks() {
  if pgrep -f "qemu-system.*@${AVD_NAME}" >/dev/null 2>&1 || pgrep -f "emulator .*@${AVD_NAME}" >/dev/null 2>&1; then
    return
  fi

  for lock_file in "${AVD_DIR}"/*.lock; do
    [[ -e "${lock_file}" ]] && rm -f "${lock_file}"
  done

  if [[ -d "${RUNNING_DIR}" ]]; then
    for pid_file in "${RUNNING_DIR}"/pid_*.ini; do
      [[ -e "${pid_file}" ]] || continue
      grep -q "avd.id=${AVD_NAME}" "${pid_file}" || continue
      pid="${pid_file##*/pid_}"
      pid="${pid%.ini}"
      if ! ps -p "${pid}" >/dev/null 2>&1; then
        rm -rf "${RUNNING_DIR}/${pid}" "${pid_file}"
      fi
    done
  fi
}

launch_emulator() {
  local args=(
    "@${AVD_NAME}"
    -no-window
    -no-audio
    -no-snapshot
    -gpu "${GPU_MODE}"
    -port "${PORT}"
  )

  if [[ "$(uname -s)" == "Darwin" ]] && command -v script >/dev/null 2>&1; then
    # The macOS emulator can exit when launched as a plain detached background
    # job. Running it under script(1) gives it a pty while still returning this
    # launcher after boot.
    nohup script -q "${LOG_FILE}" "${EMULATOR_BIN}" "${args[@]}" >"${LAUNCH_LOG_FILE}" 2>&1 &
    disown "$!" 2>/dev/null || true
  else
    nohup "${EMULATOR_BIN}" "${args[@]}" </dev/null >"${LOG_FILE}" 2>&1 &
    disown "$!" 2>/dev/null || true
  fi
}

wait_until_ready() {
  local deadline=$((SECONDS + BOOT_TIMEOUT_SECONDS))
  local state=''
  local boot_completed=''

  while (( SECONDS < deadline )); do
    state="$(device_state || true)"
    if [[ "${state}" == "device" ]]; then
      boot_completed="$("${ADB_BIN}" -s "${SERIAL}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
      if [[ "${boot_completed}" == "1" ]]; then
        set_device_locale
        echo "Android emulator ready: ${SERIAL} (${AVD_NAME})"
        return
      fi
    fi
    sleep 2
  done

  echo "Timed out waiting for ${SERIAL} to boot. Last emulator log:" >&2
  tail -n 80 "${LOG_FILE}" >&2 || true
  exit 1
}

"${ADB_BIN}" start-server >/dev/null

if [[ "$(device_state || true)" == "device" ]]; then
  set_device_locale
  echo "Android emulator already ready: ${SERIAL} (${AVD_NAME})"
  exit 0
fi

cleanup_stale_locks

echo "Starting Android emulator: ${AVD_NAME} on ${SERIAL}"
launch_emulator

wait_until_ready
