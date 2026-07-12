#!/bin/zsh

set -euo pipefail

SOURCE_REPO_DIR="/Users/marcusmoon/SignalApp"
DEPLOY_REPO_DIR="/Users/marcusmoon/SignalApp-deploy"
STATE_DIR="${HOME}/Library/Caches/SignalApp"
LOCK_DIR="${STATE_DIR}/auto-ios-ota-deploy.lock"
LOCK_PID_FILE="${LOCK_DIR}/pid"
LOG_DIR="${HOME}/Library/Logs/SignalApp"
LOG_FILE="${LOG_DIR}/auto-ios-ota-deploy.log"

mkdir -p "${STATE_DIR}" "${LOG_DIR}"

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  existing_pid=""
  if [[ -f "${LOCK_PID_FILE}" ]]; then
    existing_pid="$(<"${LOCK_PID_FILE}")"
  fi

  if [[ -n "${existing_pid}" ]] && kill -0 "${existing_pid}" 2>/dev/null; then
    {
      printf '[%s] skip: previous run still active (pid=%s)\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${existing_pid}"
    } >> "${LOG_FILE}"
    exit 0
  fi

  rm -f "${LOCK_PID_FILE}" 2>/dev/null || true
  rmdir "${LOCK_DIR}" 2>/dev/null || true

  if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
    {
      printf '[%s] skip: unable to acquire lock\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    } >> "${LOG_FILE}"
    exit 0
  fi

  {
    printf '[%s] recovered stale lock\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  } >> "${LOG_FILE}"
fi

printf '%s\n' "$$" > "${LOCK_PID_FILE}"

cleanup() {
  rm -f "${LOCK_PID_FILE}" 2>/dev/null || true
  rmdir "${LOCK_DIR}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

exec >> "${LOG_FILE}" 2>&1

printf '\n[%s] start auto OTA deploy\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
export CI=1
export EXPO_NO_TELEMETRY=1

if [[ -f "${HOME}/.zprofile" ]]; then
  # shellcheck disable=SC1090
  source "${HOME}/.zprofile"
fi

if [[ -f "${HOME}/.zshrc" ]]; then
  # shellcheck disable=SC1090
  source "${HOME}/.zshrc"
fi

ensure_deploy_worktree() {
  if [[ ! -e "${DEPLOY_REPO_DIR}/.git" ]]; then
    printf '[%s] create deploy worktree: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${DEPLOY_REPO_DIR}"
    git -C "${SOURCE_REPO_DIR}" fetch origin
    git -C "${SOURCE_REPO_DIR}" worktree add --detach "${DEPLOY_REPO_DIR}" origin/main
  fi

  if [[ ! -e "${DEPLOY_REPO_DIR}/node_modules" ]]; then
    ln -s "${SOURCE_REPO_DIR}/node_modules" "${DEPLOY_REPO_DIR}/node_modules"
  fi
}

ensure_deploy_worktree

cd "${DEPLOY_REPO_DIR}"

before_sha="$(git rev-parse HEAD)"
printf '[%s] current sha: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${before_sha}"

git fetch origin
after_sha="$(git rev-parse origin/main)"

if [[ "${before_sha}" == "${after_sha}" ]]; then
  printf '[%s] no source changes\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  exit 0
fi

git reset --hard "${after_sha}"

printf '[%s] updated sha: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${after_sha}"

"${SOURCE_REPO_DIR}/node_modules/.bin/tsc" --noEmit --pretty false

npx eas update \
  --channel production \
  --environment production \
  --platform ios \
  --message "auto OTA iOS production update ${after_sha[1,7]}"

printf '[%s] deploy complete\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
