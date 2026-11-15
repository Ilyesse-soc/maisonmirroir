#!/bin/bash
set -euo pipefail
umask 077
[[ $EUID -eq 0 ]] || exit 1
[[ $# -eq 1 && "$1" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 64
cd /opt/maison-miroir/ops
exec 9>/run/maison-miroir-release.lock
flock -n 9 || { echo RELEASE_ALREADY_RUNNING;exit 1; }
image="ghcr.io/ilyesse-soc/maisonmirroir@$1"
test -s secrets/app.env
test -s secrets/migrate.env
test -s .env
python3 /opt/maison-miroir/ops/preflight.py
previous="$(sed -n 's/^APP_IMAGE=//p' .env)"
[[ "$previous" =~ ^ghcr.io/ilyesse-soc/maisonmirroir@sha256:[a-f0-9]{64}$ ]] || exit 1
backup_image="$(sed -n 's/^BACKUP_IMAGE=//p' .env)"
[[ "$backup_image" =~ ^ghcr.io/ilyesse-soc/maisonmirroir-backup@sha256:[a-f0-9]{64}$ ]] || exit 1
# The CI job passes its short-lived read-only registry token through encrypted SSH stdin.
IFS= read -r registry_user
IFS= read -r registry_token
[[ "$registry_user" =~ ^[a-zA-Z0-9-]{1,39}$ && -n "$registry_token" ]] || exit 1
registry_dir="$(mktemp -d /run/mm-ghcr.XXXXXX)"
trap 'rm -f -- "$registry_dir/config.json"; rmdir -- "$registry_dir"' EXIT
printf '%s' "$registry_token" | docker --config "$registry_dir" login ghcr.io --username "$registry_user" --password-stdin
unset registry_token
# A source-complete, verified backup/import is a separate pre-migration gate. A release never imports orders implicitly.
cp .env .env.previous
printf '%s\n' "$previous" > last-good-image
docker image inspect "$previous" >/dev/null && docker tag "$previous" maison-miroir:rollback
docker --config "$registry_dir" pull "$image"
docker --config "$registry_dir" pull "$backup_image"
APP_IMAGE="$image" docker compose --env-file .env -f compose.yml run --rm --no-deps migrate
sed -i "s|^APP_IMAGE=.*|APP_IMAGE=$image|" .env
if ! docker compose --env-file .env -f compose.yml up -d --no-build --wait --wait-timeout 150 app worker caddy;then
  cp .env.previous .env
  docker compose --env-file .env -f compose.yml up -d --no-build --wait --wait-timeout 150 app worker caddy
  echo RELEASE_FAILED_CODE_ROLLED_BACK >&2
  exit 1
fi
echo RELEASE_HEALTHY
# Keep the previous image for rollback. Never prune volumes or reset the database during deployment.
