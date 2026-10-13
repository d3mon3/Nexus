#!/bin/sh
# Builds the champion statistics (Tier List / Champions / Builds) from real ranked games.
# Runs as soon as a Riot key exists, then a new batch every AGGREGATE_EVERY_MIN minutes, so the
# statistics keep growing all day. It uses at most RIOT_RATE_SHARE of the key's rate limit and
# leaves the rest for the website.
set -u
STAMP="${NEXUS_DATA_DIR:-/data}/last-aggregate"
EVERY=$(( ${AGGREGATE_EVERY_MIN:-45} * 60 ))
export RIOT_RATE_SHARE="${RIOT_RATE_SHARE:-0.6}"

has_key() { [ -s "${NEXUS_DATA_DIR:-/data}/riot-key.txt" ] || [ -n "${RIOT_API_KEY:-}" ]; }
run() {
  npx tsx --conditions=react-server scripts/aggregate.ts \
    --platform "${NEXUS_DEFAULT_PLATFORM:-euw1}" \
    --players "${AGGREGATE_PLAYERS:-50}" \
    --matches "${AGGREGATE_MATCHES:-12}" \
    --modes "${AGGREGATE_MODES:-sr,aram,aram-mayhem,arena,urf}" \
    --mode-matches "${AGGREGATE_MODE_MATCHES:-40}"
}

sleep 90 # let the app create the database tables first

# LP tracker: snapshot ranks of recently viewed players every few minutes, in the background,
# so each ranked game can be given its exact LP change.
(
  while true; do
    has_key && npx tsx --conditions=react-server scripts/track-lp.ts
    sleep "${LP_TRACK_INTERVAL:-180}"
  done
) &

while true; do
  now=$(date +%s)
  last=$(cat "$STAMP" 2>/dev/null || echo 0)
  if has_key; then
    if [ $((now - last)) -ge "$EVERY" ]; then
      echo "[aggregate] starting $(date)"
      if run; then
        date +%s > "$STAMP"
        echo "[aggregate] done $(date)"
      else
        echo "[aggregate] failed (expired key or Riot busy) — retrying in 30 minutes"
        sleep 1800
      fi
    fi
  fi
  sleep 300
done
