#!/usr/bin/env bash
# Starts a throwaway local Postgres 16 on port 54329 under .data/pg (dev/test only).
set -euo pipefail
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="${PWD}/.data/pg"
PORT="${PGPORT:-54329}"
mkdir -p .data
if [ ! -f "$DATA/PG_VERSION" ]; then
  "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
fi
if ! "$PGBIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp" -l .data/pg.log start >/dev/null
fi
for db in lms lms_test; do
  psql -h 127.0.0.1 -p "$PORT" -U postgres -tc "select 1 from pg_database where datname='$db'" | grep -q 1 \
    || psql -h 127.0.0.1 -p "$PORT" -U postgres -c "create database $db" >/dev/null
done
echo "Postgres ready: postgres://postgres@127.0.0.1:$PORT/lms (and lms_test)"
