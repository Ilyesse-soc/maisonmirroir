#!/bin/sh
set -eu
set -o pipefail
export PGHOST=/tmp PGUSER=postgres RESTIC_PASSWORD=synthetic-test-password
export RESTIC_REPOSITORY=/tmp/synthetic-restic
initdb -D /tmp/synthetic-pg -A trust --no-locale >/dev/null
pg_ctl -D /tmp/synthetic-pg -o "-h '' -k /tmp" -w start >/dev/null
trap 'pg_ctl -D /tmp/synthetic-pg -m immediate -w stop >/dev/null' EXIT
createdb synthetic_source
psql -d synthetic_source -v ON_ERROR_STOP=1 -c \
  "CREATE SCHEMA mm_live; CREATE TABLE mm_live.fixture(id integer PRIMARY KEY, value text); INSERT INTO mm_live.fixture VALUES(1, 'synthetic-order-fixture');" >/dev/null
restic --no-cache init >/dev/null
pg_dump -d synthetic_source --format=custom --no-owner --no-acl --schema=mm_live |
  restic --no-cache backup --stdin --stdin-filename postgres/maison-miroir.dump --tag pending-test-success --host ovh-vps1 >/dev/null
restic --no-cache tag --tag pending-test-success --host ovh-vps1 --add maison-miroir --remove pending-test-success >/dev/null
if (printf 'incomplete'; exit 1) |
  restic --no-cache backup --stdin --stdin-filename postgres/maison-miroir.dump --tag pending-test-failure --host ovh-vps1 >/dev/null; then
  echo 'Failed dump unexpectedly succeeded' >&2
  exit 1
fi
printf '%s' 'synthetic-config-fixture' |
  restic --no-cache backup --stdin --stdin-filename config/maison-miroir.tar --tag pending-test-config --host ovh-vps1 >/dev/null
restic --no-cache tag --tag pending-test-config --host ovh-vps1 --add maison-miroir-config --remove pending-test-config >/dev/null
restic --no-cache check --read-data >/dev/null
createdb synthetic_restore
restic --no-cache dump --tag maison-miroir latest postgres/maison-miroir.dump |
  pg_restore --no-owner --no-acl -d synthetic_restore
test "$(psql -d synthetic_restore -At -c 'SELECT value FROM mm_live.fixture WHERE id=1')" = 'synthetic-order-fixture'
test "$(restic --no-cache dump --tag maison-miroir-config latest config/maison-miroir.tar)" = 'synthetic-config-fixture'
if grep -R -a -q 'synthetic-order-fixture\|synthetic-config-fixture' "$RESTIC_REPOSITORY"; then
  echo 'Synthetic plaintext found in encrypted repository' >&2
  exit 1
fi
echo 'PASS: encrypted synthetic database and configuration snapshots were verified and restored in isolation.'
