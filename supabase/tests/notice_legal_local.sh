#!/usr/bin/env bash
# Runs both temporal Vade Mecum migrations and SQL suites against a throwaway
# local Postgres (never a real project). Order: fixtures -> migrations -> suites.
set -euo pipefail
R="$(cd "$(dirname "$0")/.." && pwd)"
[ -n "${PG_BIN:-}" ] && export PATH="$PG_BIN:$PATH"
D=$(mktemp -d); PORT=55441
if [ "$(id -u)" = 0 ]; then U=$(id -nu 1000 2>/dev/null || echo nobody); RUN="setpriv --reuid=1000 --regid=1000 --clear-groups --"; chown 1000:1000 "$D"; else RUN=""; fi
$RUN initdb -D "$D/data" -A trust -U postgres >/dev/null
$RUN pg_ctl -D "$D/data" -o "-p $PORT -k $D -c listen_addresses=''" -l "$D/log" start -w >/dev/null
trap '$RUN pg_ctl -D "$D/data" stop -m immediate >/dev/null' EXIT
P="psql -X -q -v ON_ERROR_STOP=1 -h $D -p $PORT -U postgres -d postgres"
for f in tests/notice_legal_snapshots_fixture.sql tests/question_notice_legal_context_fixture.sql \
  pending/20261117130000_notice_legal_snapshots.sql pending/20261117140000_question_notice_legal_context.sql pending/20261119150000_list_reader_notices.sql \
  pending/20261117130000_notice_legal_snapshots.sql pending/20261117140000_question_notice_legal_context.sql pending/20261119150000_list_reader_notices.sql \
  tests/notice_legal_snapshots.sql tests/question_notice_legal_context.sql tests/list_reader_notices.sql; do
  $P -f "$R/$f" >/dev/null || { echo "FAIL: $f"; exit 1; }; echo "PASS: $f"
done
echo "ALL PASS"
