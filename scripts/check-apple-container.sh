#!/usr/bin/env bash
# Check the host prerequisites for the optional Apple container workflow.
# This script only reports missing prerequisites; it never installs or starts anything.

set -u

readonly CONTAINER_RELEASES_URL="https://github.com/apple/container/releases"
failures=0

report_error() {
  printf 'ERROR: %s\n' "$1" >&2
  failures=1
}

os_name=$(uname -s 2>/dev/null || printf 'unknown')
architecture=$(uname -m 2>/dev/null || printf 'unknown')

if [ "$os_name" != "Darwin" ]; then
  report_error "Apple container requires macOS (Darwin); detected ${os_name}."
fi

if [ "$architecture" != "arm64" ]; then
  report_error "Apple container requires Apple silicon (arm64); detected ${architecture}."
fi

# The remaining checks are meaningful only on the required host platform.
if [ "$failures" -eq 0 ]; then
  if ! command -v sw_vers >/dev/null 2>&1; then
    report_error "Cannot determine the macOS version because sw_vers is unavailable."
  else
    macos_version=$(sw_vers -productVersion 2>/dev/null || printf '')
    macos_major=${macos_version%%.*}

    case "$macos_major" in
      ''|*[!0-9]*)
        report_error "Cannot determine the macOS version from sw_vers output: ${macos_version:-empty}."
        ;;
      *)
        if [ "$macos_major" -lt 26 ]; then
          report_error "Apple container requires macOS 26 or newer; detected macOS ${macos_version}."
        fi
        ;;
    esac
  fi

  if ! command -v container >/dev/null 2>&1; then
    report_error "The container CLI is not installed. Download the latest signed installer package from ${CONTAINER_RELEASES_URL}."
  elif ! container system status >/dev/null 2>&1; then
    report_error "The container system service is unavailable. Start it with: container system start"
  fi
fi

if [ "$failures" -ne 0 ]; then
  exit 1
fi

printf 'Apple container prerequisites are available (macOS %s, %s, container service ready).\n' "$macos_version" "$architecture"
