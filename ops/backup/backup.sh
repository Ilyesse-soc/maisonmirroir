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
if [ "${1:-}" = '--check-data' ];then
  part=$((($(date -u +%s) / 86400) % 30 + 1))
  exec restic --no-cache check --read-data-subset "$part/30"
fi
if [ "${1:-}" = '--export-latest' ];then exec restic --no-cache dump --tag maison-miroir latest postgres/maison-miroir.dump;fi
if [ "${1:-}" = '--export-config-latest' ];then exec restic --no-cache dump --tag maison-miroir-config latest config/maison-miroir.tar;fi
if [ "${1:-}" = '--config-stdin' ];then
  pending="pending-$(cat /proc/sys/kernel/random/uuid)"
  if ! restic --no-cache --limit-upload 4096 backup --stdin --stdin-filename config/maison-miroir.tar --tag "$pending" --host ovh-vps1; then
    restic --no-cache forget --tag "$pending" --host ovh-vps1 || echo PENDING_SNAPSHOT_CLEANUP_FAILED >&2
    echo CONFIG_BACKUP_FAILED >&2
    exit 1
  fi
  restic --no-cache tag --tag "$pending" --host ovh-vps1 --add maison-miroir-config --remove "$pending"
  restic --no-cache check
  restic --no-cache forget --tag maison-miroir-config --host ovh-vps1 --keep-daily 30 --keep-weekly 4 --keep-monthly 6 --prune
  echo CONFIG_BACKUP_VERIFIED
  exit
fi
backup_once(){
  pending="pending-$(cat /proc/sys/kernel/random/uuid)"
  # A failed stream must never be selectable as the latest complete backup.
  if ! pg_dump --format=custom --no-owner --no-acl --schema=mm_live |
    restic --no-cache --limit-upload 4096 backup --stdin --stdin-filename postgres/maison-miroir.dump --tag "$pending" --host ovh-vps1;then
    restic --no-cache forget --tag "$pending" --host ovh-vps1 || echo PENDING_SNAPSHOT_CLEANUP_FAILED >&2
    echo DATABASE_BACKUP_FAILED >&2
    return 1
  fi
  restic --no-cache tag --tag "$pending" --host ovh-vps1 --add maison-miroir --remove "$pending"
  restic --no-cache check
  restic --no-cache forget --tag maison-miroir --host ovh-vps1 --keep-daily 30 --keep-weekly 4 --keep-monthly 6 --prune
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
