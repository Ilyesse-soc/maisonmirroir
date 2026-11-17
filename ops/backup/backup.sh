#!/bin/sh
set -eu
set -o pipefail
umask 077
export PGPASSWORD="$(cat /run/secrets/backup_db_password)"
export AWS_ACCESS_KEY_ID="$(cat /run/secrets/s3_access_key)"
export AWS_SECRET_ACCESS_KEY="$(cat /run/secrets/s3_secret_key)"
case "${RESTIC_REPOSITORY:-}" in s3:https://*) ;; *) echo BACKUP_REPOSITORY_NOT_CONFIGURED >&2;exit 1;; esac
test -s "$RESTIC_PASSWORD_FILE" || exit 1
if [ "${1:-}" = '--init' ];then exec restic --no-cache init;fi
if [ "${1:-}" = '--check' ];then exec restic --no-cache check;fi
if [ "${1:-}" = '--export-latest' ];then exec restic --no-cache dump latest postgres/maison-miroir.dump;fi
backup_once(){
  # pipefail prevents treating a failed pg_dump as a valid empty backup.
  pg_dump --format=custom --no-owner --no-acl --schema=mm_live |
    restic --no-cache --limit-upload 4096 backup --stdin --stdin-filename postgres/maison-miroir.dump --tag maison-miroir --host ovh-vps1
  restic --no-cache check
  restic --no-cache forget --tag maison-miroir --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
  date +%s > /tmp/last-backup-success
  echo BACKUP_VERIFIED
}
if [ "${1:-}" = '--once' ];then backup_once;exit;fi
last_day=''
while :;do
  date +%s > /tmp/backup-heartbeat
  day="$(date -u +%F)"
  hour="$(date -u +%H%M)"
  if [ "$hour" -ge 315 ] && [ "$last_day" != "$day" ];then
    backup_once || { echo BACKUP_FAILED >&2;exit 1; }
    last_day="$day"
  fi
  sleep 60
done
