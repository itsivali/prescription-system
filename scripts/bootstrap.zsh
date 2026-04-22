#!/usr/bin/env zsh
# Bootstraps a local dev environment: Postgres + Redis + Prisma migrations + seed data.
# Idempotent — safe to re-run.

set -euo pipefail

ROOT="${0:A:h:h}"
cd "$ROOT"

log() { print -P "%F{cyan}[bootstrap]%f $*"; }
err() { print -P "%F{red}[bootstrap]%f $*" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "missing required command: $1"
    err "enter the dev shell first: nix develop"
    exit 1
  fi
}

for cmd in initdb pg_ctl psql createdb redis-server pnpm; do
  require_cmd "$cmd"
done

# ----------------------------------------------------------------------------
# 1. Postgres — initialize a project-local cluster, then start it
# ----------------------------------------------------------------------------
: "${PGDATA:=$ROOT/.pgdata}"
: "${PGHOST:=$ROOT/.pgsock}"
: "${PGPORT:=5433}"
: "${PGUSER:=hospital}"
: "${PGPASSWORD:=hospital_dev}"
: "${PGDATABASE:=hospital_crm}"

mkdir -p "$PGHOST"

if [[ ! -d "$PGDATA/base" ]]; then
  log "initializing postgres cluster at $PGDATA"
  initdb -D "$PGDATA" -U "$PGUSER" --auth=trust --no-locale --encoding=UTF8 >/dev/null
fi

if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  log "starting postgres on port $PGPORT"
  pg_ctl -D "$PGDATA" -l "$PGDATA/server.log" \
    -o "-c listen_addresses='127.0.0.1' -c port=$PGPORT -c unix_socket_directories='$PGHOST'" \
    start >/dev/null
fi

# Create role + database if missing
if ! psql -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" -lqt | cut -d '|' -f1 | grep -qw "$PGDATABASE"; then
  log "creating database $PGDATABASE"
  createdb -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" "$PGDATABASE"
fi

# ----------------------------------------------------------------------------
# 2. Redis — used for nonce store (one-time QR replay protection)
# ----------------------------------------------------------------------------
: "${REDIS_PORT:=6380}"
if ! pgrep -f "redis-server.*:$REDIS_PORT" >/dev/null; then
  mkdir -p "$ROOT/.redis"
  log "starting redis on port $REDIS_PORT"
  redis-server --port "$REDIS_PORT" --daemonize yes --dir "$ROOT/.redis" \
    --logfile "$ROOT/.redis/redis.log" --save "" --appendonly no
fi

# ----------------------------------------------------------------------------
# 3. Install JS deps + Prisma migrate + seed
# ----------------------------------------------------------------------------
cd "$ROOT/services/core-api"

if [[ ! -d node_modules ]]; then
  log "installing node deps (pnpm install)"
  pnpm install --silent
fi

log "running prisma generate + migrate deploy"
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 pnpm exec prisma generate >/dev/null
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 pnpm exec prisma migrate deploy >/dev/null 2>&1 \
  || PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 pnpm exec prisma migrate dev --name init --skip-seed

log "seeding baseline data (departments, drug classes, demo doctor/patient)"
pnpm exec ts-node prisma/seed.ts

log "done. API: cd services/core-api && pnpm dev"
