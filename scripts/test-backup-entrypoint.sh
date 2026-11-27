#!/bin/sh
set -eu
mkdir -p /run/secrets /tmp/fake-bin
printf x >/run/secrets/backup_db_password
printf x >/run/secrets/s3_access_key
printf x >/run/secrets/s3_secret_key
printf x >/tmp/restic-password
export RESTIC_PASSWORD_FILE=/tmp/restic-password RESTIC_REPOSITORY=s3:https://synthetic.invalid/bucket
export PATH="/tmp/fake-bin:$PATH"
cat >/tmp/fake-bin/restic <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >>/tmp/restic-calls
case "$*" in *" backup "*) cat >/dev/null ;; esac
EOF
cat >/tmp/fake-bin/pg_dump <<'EOF'
#!/bin/sh
if [ "${FAIL_DUMP:-0}" = 1 ]; then exit 1; fi
printf 'synthetic database'
EOF
chmod +x /tmp/fake-bin/restic /tmp/fake-bin/pg_dump
: >/tmp/restic-calls
FAIL_DUMP=1 sh /usr/local/bin/mm-backup --once >/dev/null 2>&1 && exit 1
grep -q ' backup .*--tag pending-' /tmp/restic-calls
grep -q ' forget --tag pending-' /tmp/restic-calls
if grep -q ' --add maison-miroir\| --keep-daily ' /tmp/restic-calls; then exit 1; fi
: >/tmp/restic-calls
sh /usr/local/bin/mm-backup --once >/dev/null
grep -q ' tag --tag pending-.*--add maison-miroir --remove pending-' /tmp/restic-calls
grep -q ' forget --tag maison-miroir --host ovh-vps1 --keep-daily 30 --keep-weekly 4 --keep-monthly 6 --prune' /tmp/restic-calls
: >/tmp/restic-calls
printf synthetic-config | sh /usr/local/bin/mm-backup --config-stdin >/dev/null
grep -q ' tag --tag pending-.*--add maison-miroir-config --remove pending-' /tmp/restic-calls
grep -q ' forget --tag maison-miroir-config --host ovh-vps1 --keep-daily 30' /tmp/restic-calls
: >/tmp/restic-calls
sh /usr/local/bin/mm-backup --export-latest
sh /usr/local/bin/mm-backup --export-config-latest
grep -q ' dump --tag maison-miroir latest postgres/maison-miroir.dump' /tmp/restic-calls
grep -q ' dump --tag maison-miroir-config latest config/maison-miroir.tar' /tmp/restic-calls
echo 'PASS: failed dump remains unpromoted; complete snapshots, retention and exports use separate tags.'
