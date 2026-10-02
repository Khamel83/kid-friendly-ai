#!/usr/bin/env bash
set -euo pipefail

# Run only against a clean, built, disposable checkout. No provider request is made.
cd "$(dirname "$0")/.."
port="${1:-43117}"
if [[ ! "$port" =~ ^[0-9]+$ ]] || (( port < 1024 || port > 65535 )); then
  echo 'usage: ops/recovery-probe.sh [private-port]' >&2
  exit 2
fi
if [[ ! -d .next ]] || [[ ! -d node_modules ]]; then
  echo 'Run npm ci and npm run build in a clean release first' >&2
  exit 2
fi
for env_file in .env .env.local .env.production .env.production.local; do
  if [[ -e "$env_file" ]]; then
    echo "Refusing provider-bearing local file: $env_file" >&2
    exit 2
  fi
done

base="http://127.0.0.1:$port"
curl_loopback() {
  curl --noproxy '*' "$@"
}
if curl_loopback --silent --output /dev/null --max-time 1 "$base/"; then
  echo "Refusing occupied loopback port: $port" >&2
  exit 2
fi
log="$(mktemp)"
cleanup() {
  if [[ -n "${cleaning:-}" ]]; then
    return
  fi
  cleaning=1
  if [[ -n "${server_pid:-}" ]]; then
    kill -TERM -- "-$server_pid" 2>/dev/null || true
    for _ in {1..10}; do
      if ! kill -0 "$server_pid" 2>/dev/null; then
        break
      fi
      sleep 0.2
    done
    if kill -0 "$server_pid" 2>/dev/null; then
      kill -KILL -- "-$server_pid" 2>/dev/null || true
    fi
    wait "$server_pid" 2>/dev/null || true
    server_pid=""
  fi
  rm -f "$log"
  cleaning=""
}
trap cleanup EXIT
trap 'trap - TERM INT; cleanup; exit 143' TERM INT
setsid env -u OPENROUTER_API_KEY -u OPENAI_API_KEY -u ELEVENLABS_API_KEY \
  node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port "$port" >"$log" 2>&1 &
server_pid=$!
ready=0
for _ in {1..40}; do
  if curl_loopback --silent --output /dev/null --max-time 1 "$base/"; then
    ready=1
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then break; fi
  sleep 1
done
if (( ready == 0 )); then
  echo 'Private Buddy process did not start' >&2
  exit 1
fi
if ! kill -0 "$server_pid" 2>/dev/null; then
  echo 'Private Buddy process exited before the probe' >&2
  exit 1
fi

home_status="$(curl_loopback --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "$base/")"
health_status="$(curl_loopback --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "$base/api/health")"
# The JavaScript template literal is intentionally single-quoted for the shell.
# shellcheck disable=SC2016
health_checks="$(curl_loopback --silent --max-time 5 "$base/api/health" | node -e '
  let body = "";
  process.stdin.on("data", chunk => body += chunk);
  process.stdin.on("end", () => {
    const checks = JSON.parse(body).checks;
    process.stdout.write(`memory=${checks.memory} api=${checks.api}`);
  });
')"
invalid_status="$(curl_loopback --silent --output /dev/null --write-out '%{http_code}' --max-time 5 \
  --header 'Content-Type: application/json' --data '{"question":""}' "$base/api/ask")"
printf 'source=%s bind=127.0.0.1 home=%s health=%s %s invalid_ask=%s provider_request=none\n' \
  "$(git rev-parse HEAD 2>/dev/null || echo archive)" \
  "$home_status" "$health_status" "$health_checks" "$invalid_status"
[[ "$home_status" == 200 && "$invalid_status" == 400 ]]
cleanup
server_pid=""
if curl_loopback --silent --output /dev/null --max-time 1 "$base/"; then
  echo "Private Buddy process or port remained after cleanup: $port" >&2
  exit 1
fi
