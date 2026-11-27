#!/bin/bash
set -euo pipefail
umask 077
cd /opt/maison-miroir/ops
exec 9>/run/maison-miroir-backup/lock
flock -n 9 || { echo BACKUP_ALREADY_RUNNING >&2; exit 1; }
compose=(docker compose --env-file .env -f compose.yml)
"${compose[@]}" run --rm --no-deps backup --once
staging="$(mktemp -d /run/maison-miroir-backup/config.XXXXXXXX)"
trap 'rm -f -- "$staging/config.tar"; rmdir -- "$staging"' EXIT
(
  cd /
  tar -hcf "$staging/config.tar" \
    opt/maison-miroir/ops/.env opt/maison-miroir/ops/compose.yml \
    opt/maison-miroir/ops/nginx.conf opt/maison-miroir/ops/preflight.py \
    opt/maison-miroir/ops/postgres/postgresql.conf \
    opt/maison-miroir/ops/postgres/pg_hba.conf opt/maison-miroir/ops/postgres/init.sh \
    opt/maison-miroir/ops/secrets/app.env opt/maison-miroir/ops/secrets/migrate.env \
    opt/maison-miroir/ops/secrets/postgres_password opt/maison-miroir/ops/secrets/app_db_password \
    opt/maison-miroir/ops/secrets/migrate_db_password opt/maison-miroir/ops/secrets/backup_db_password \
    opt/maison-miroir/ops/secrets/db-server.crt opt/maison-miroir/ops/secrets/db-server.key \
    opt/maison-miroir/ops/secrets/db-ca.crt opt/maison-miroir/ops/secrets/tls/server.crt \
    opt/maison-miroir/ops/secrets/tls/server.key etc/letsencrypt usr/local/sbin/mm-release
)
tar -tf "$staging/config.tar" >/dev/null
"${compose[@]}" run -T --rm --no-deps backup --config-stdin < "$staging/config.tar"
"${compose[@]}" run --rm --no-deps backup --check-data
echo DAILY_BACKUP_COMPLETE
