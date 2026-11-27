#!/bin/bash
set -euo pipefail
mkdir -p /opt/maison-miroir/ops/{postgres,secrets/tls} /usr/local/sbin /etc/letsencrypt /run/maison-miroir-backup /tmp/mock-bin
cd /opt/maison-miroir/ops
for f in .env compose.yml nginx.conf preflight.py postgres/postgresql.conf postgres/pg_hba.conf postgres/init.sh \
  secrets/app.env secrets/migrate.env secrets/postgres_password secrets/app_db_password \
  secrets/migrate_db_password secrets/backup_db_password secrets/db-server.crt secrets/db-server.key \
  secrets/db-ca.crt secrets/tls/server.key; do
  printf 'synthetic\n' >"$f"
done
printf 'synthetic-linked-certificate\n' >/opt/synthetic-certificate
ln -s /opt/synthetic-certificate secrets/tls/server.crt
printf 'synthetic\n' >/usr/local/sbin/mm-release
printf 'synthetic\n' >/etc/letsencrypt/config
cat >/tmp/mock-bin/docker <<'EOF'
#!/bin/bash
set -euo pipefail
printf '%s\n' "$*" >>/tmp/docker-calls
case "$*" in
  *--once) [ "${FAIL_STEP:-}" != once ] ;;
  *--config-stdin)
    [ "${FAIL_STEP:-}" != config ] || exit 1
    cat >/tmp/config-fixture.tar
    [ "$(tar -xOf /tmp/config-fixture.tar opt/maison-miroir/ops/secrets/tls/server.crt)" = synthetic-linked-certificate ]
    tar -tf /tmp/config-fixture.tar | grep -Fxq usr/local/sbin/mm-release
    tar -tf /tmp/config-fixture.tar | grep -Fxq opt/maison-miroir/ops/preflight.py
    tar -tf /tmp/config-fixture.tar | grep -Fxq etc/letsencrypt/config
    ;;
  *--check-data) [ "${FAIL_STEP:-}" != check ] ;;
  *) exit 1 ;;
esac
EOF
chmod +x /tmp/mock-bin/docker
export PATH="/tmp/mock-bin:$PATH"
for step in once config check; do
  : >/tmp/docker-calls
  if FAIL_STEP="$step" bash /subject.sh >/dev/null 2>&1; then
    echo "Expected failure at $step" >&2
    exit 1
  fi
  [ -z "$(find /run/maison-miroir-backup -name 'config.*' -print -quit)" ]
  if [ "$step" = once ] && grep -q -- '--config-stdin' /tmp/docker-calls; then exit 1; fi
  if [ "$step" = config ] && grep -q -- '--check-data' /tmp/docker-calls; then exit 1; fi
done
: >/tmp/docker-calls
bash /subject.sh >/dev/null
test "$(wc -l </tmp/docker-calls)" -eq 3
[ -z "$(find /run/maison-miroir-backup -name 'config.*' -print -quit)" ]
echo 'PASS: backup orchestration propagates failures, cleans staging and archives dereferenced configuration.'
