#!/usr/bin/env bash
# One-command NEXUS server install for a fresh Ubuntu/Debian VPS (2 GB RAM or more).
#
#   curl -fsSL https://raw.githubusercontent.com/LOGIN/nexus/main/deploy/install.sh | sudo bash -s -- https://github.com/LOGIN/nexus.git
#
# It installs Docker, adds swap, downloads NEXUS to /opt/nexus, generates passwords,
# gets an HTTPS address (<ip>.sslip.io unless DOMAIN=... is given) and starts everything.
# Running it again updates NEXUS and keeps your settings and data.
set -euo pipefail

REPO_URL="${1:-${NEXUS_REPO:-}}"
DIR="${NEXUS_DIR:-/opt/nexus}"

say() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mBłąd: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "uruchom przez sudo (albo jako root)."

say "Instaluję potrzebne programy"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl openssl ca-certificates >/dev/null
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "brak 'docker compose' — zainstaluj Docker ponownie."

if [ "$(swapon --show | wc -l)" = 0 ] && [ ! -f /swapfile ]; then
  say "Dodaję 2 GB swap (budowanie aplikacji potrzebuje pamięci)"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "Pobieram NEXUS do $DIR"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  [ -n "$REPO_URL" ] || die "podaj adres repozytorium, np.: ... | sudo bash -s -- https://github.com/LOGIN/nexus.git"
  git clone --depth 1 "$REPO_URL" "$DIR"
fi
cd "$DIR"

if [ ! -f .env ]; then
  say "Tworzę ustawienia (.env)"
  IP="$(curl -4 -fsS https://api.ipify.org || curl -4 -fsS https://ifconfig.me || hostname -I | awk '{print $1}')"
  [ -n "$IP" ] || die "nie udało się ustalić publicznego IP serwera."
  DOMAIN_VALUE="${DOMAIN:-${IP//./-}.sslip.io}"
  ADMIN_PW="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 20)"
  cat > .env <<ENV
# NEXUS server settings. Riot key: paste it at https://${DOMAIN_VALUE}/admin (not here).
DOMAIN=${DOMAIN_VALUE}
ADMIN_PASSWORD=${ADMIN_PW}
DB_PASSWORD=$(openssl rand -hex 24)
NEXUS_DEFAULT_PLATFORM=${PLATFORM:-euw1}
TZ=${TZ:-Europe/Warsaw}
AGGREGATE_HOUR=4
AGGREGATE_PLAYERS=40
AGGREGATE_MATCHES=10
ENV
  chmod 600 .env
fi
# shellcheck disable=SC1091
set -a && . ./.env && set +a

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null
fi

say "Buduję i uruchamiam (pierwszy raz trwa 5–15 minut)"
docker compose up -d --build

say "Czekam, aż serwer wystartuje"
for _ in $(seq 1 90); do
  if curl -fsS "https://${DOMAIN}/api/status" >/dev/null 2>&1; then OK=1; break; fi
  sleep 5
done

cat <<DONE

==========================================================
  NEXUS działa${OK:+ ✔}${OK:- (certyfikat HTTPS może potrzebować jeszcze minuty)}

  Adres serwera:   https://${DOMAIN}
  Panel admina:    https://${DOMAIN}/admin
  Hasło admina:    ${ADMIN_PASSWORD}

  1. Otwórz panel admina na telefonie i wklej klucz Riot.
  2. Ten adres wpisz w GitHub → Actions → Build desktop app
     (pole „server_url”), żeby zbudować .exe dla znajomych.

  Hasło jest też w pliku ${DIR}/.env
  Aktualizacja później: sudo bash ${DIR}/deploy/install.sh
==========================================================
DONE
