#!/usr/bin/env bash
# Local integration: throwaway Postgres + both pending migrations + synthetic data,
# then the Vitest integration suite resolves reader/question/tutor queries against it.
# Never connects to a real project; the AI provider is stubbed in the test.
set -euo pipefail
R="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$R/.." && pwd)"
D=$(mktemp -d); PORT=55442
if [ "$(id -u)" = 0 ]; then RUN="setpriv --reuid=1000 --regid=1000 --clear-groups --"; chown 1000:1000 "$D"; else RUN=""; fi
$RUN initdb -D "$D/data" -A trust -U postgres >/dev/null
$RUN pg_ctl -D "$D/data" -o "-p $PORT -k $D -c listen_addresses=''" -l "$D/log" start -w >/dev/null
trap '$RUN pg_ctl -D "$D/data" stop -m immediate >/dev/null' EXIT
P="psql -X -q -v ON_ERROR_STOP=1 -h $D -p $PORT -U postgres -d postgres"
for f in tests/notice_legal_snapshots_fixture.sql tests/question_notice_legal_context_fixture.sql tests/practice_notice_legal_context_fixture.sql \
  pending/20261117130000_notice_legal_snapshots.sql pending/20261117140000_question_notice_legal_context.sql pending/20261119150000_list_reader_notices.sql \
  pending/20261120150000_practice_notice_legal_context.sql; do
  $P -f "$R/$f" >/dev/null
done
# Synthetic data: the inserts of the question-context suite, committed this time.
sed -n '3,/^do \$\$/p' "$R/tests/question_notice_legal_context.sql" | sed '$d' | $P >/dev/null
$P -f "$R/tests/practice_notice_legal_context_data.sql" >/dev/null
cd "$ROOT"
NOTICE_IT_PGHOST="$D" NOTICE_IT_PGPORT="$PORT" bunx vitest run src/test/notice-legal.integration.test.tsx ${IT_ARGS:-}
