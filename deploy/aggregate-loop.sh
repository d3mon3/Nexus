#!/bin/sh
# Builds the champion statistics (Tier List / Champions / Builds) from real ranked games.
# Runs once as soon as a Riot key exists, then every night at AGGREGATE_HOUR (server time zone TZ).
# It shares the Riot key's rate limit with the app, so the batch is kept small.
set -u
STAMP="${NEXUS_DATA_DIR:-/data}/last-aggregate"
HOUR="${AGGREGATE_HOUR:-4}"

has_key() { [ -s "${NEXUS_DATA_DIR:-/data}/riot-key.txt" ] || [ -n "${RIOT_API_KEY:-}" ]; }
run() {
  npx tsx --conditions=react-server scripts/aggregate.ts \
    --platform "${NEXUS_DEFAULT_PLATFORM:-euw1}" \
    --players "${AGGREGATE_PLAYERS:-40}" \
    --matches "${AGGREGATE_MATCHES:-10}"
}

sleep 90 # let the app create the database tables first
while true; do
  now=$(date +%s)
  last=$(cat "$STAMP" 2>/dev/null || echo 0)
  if has_key; then
    if [ "$last" = 0 ] || { [ $((now - last)) -gt 72000 ] && [ "$(date +%-H)" = "$HOUR" ]; }; then
      echo "[aggregate] starting $(date)"
      if run; then
        date +%s > "$STAMP"
        echo "[aggregate] done $(date)"
      else
        echo "[aggregate] failed (expired key or Riot busy) — retrying in an hour"
        sleep 3000
      fi
    fi
  fi
  sleep 600
done
