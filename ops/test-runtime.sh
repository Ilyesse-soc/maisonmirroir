#!/bin/bash
# GitHub's disposable runner only. Synthetic configuration; sending stays disabled.
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" = true ]] || { echo CI_ONLY; exit 1; }
: "${IMAGE:?}" "${GITHUB_SHA:?}"
root=/opt/maison-miroir/ops
[[ ! -e "$root" ]] || { echo CI_DIRECTORY_ALREADY_EXISTS; exit 1; }
sudo install -d -m 0755 "$root"
sudo cp -a ops/. "$root/"
sudo bash "$root/generate-secrets.sh"
sudo install -d -o 1000 -g 1000 -m 0700 "$root/bootstrap"
sudo tee "$root/.env" >/dev/null <<EOF
APP_IMAGE=$IMAGE:$GITHUB_SHA
BACKUP_IMAGE=$IMAGE-backup:$GITHUB_SHA
POSTGRES_IMAGE=$IMAGE-postgres:$GITHUB_SHA
DOMAIN=maison-miroir.test
ACME_EMAIL=qa-owner@example.test
PROXY_TLS_MODE=staging
RESTIC_REPOSITORY=s3:https://example.invalid/ci-unused
EOF
printf '\nADMIN_EMAIL=qa-owner@example.test\n' | sudo tee -a "$root/secrets/app.env" >/dev/null
compose=(sudo docker compose --env-file "$root/.env" -f "$root/compose.yml")
cleanup() {
  code=$?
  if [[ $code -ne 0 ]]; then
    "${compose[@]}" logs --tail 50 postgres app worker proxy
  fi
  # Stop containers only; do not use this CI test on a real host or delete data volumes.
  "${compose[@]}" stop app worker proxy postgres || true
  return "$code"
}
trap cleanup EXIT
"${compose[@]}" up -d --wait --wait-timeout 120 postgres
"${compose[@]}" run --rm migrate node migrate.mjs --init-admin
sudo mv "$root/bootstrap/admin-initialisation.url" "$root/bootstrap/admin-initialisation.previous.url"
"${compose[@]}" run --rm migrate node migrate.mjs --recover-admin-missing
sudo test -s "$root/bootstrap/admin-initialisation.url"
"${compose[@]}" up -d --no-build --wait --wait-timeout 150 app worker proxy
"${compose[@]}" exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
"${compose[@]}" exec -T worker node -e "if(process.env.NEWSLETTER_SEND_ENABLED!=='false'||process.env.RESEND_API_KEY)process.exit(1)"
before="$("${compose[@]}" exec -T --user postgres postgres psql -U postgres -d maison_miroir -Atqc 'SELECT count(*) FROM mm_live.mm_admin_setup')"
[[ "$before" = 1 ]]
"${compose[@]}" restart postgres app worker
"${compose[@]}" up -d --no-build --wait --wait-timeout 150 app worker proxy
after="$("${compose[@]}" exec -T --user postgres postgres psql -U postgres -d maison_miroir -Atqc 'SELECT count(*) FROM mm_live.mm_admin_setup')"
[[ "$before" = "$after" ]]
for id in $("${compose[@]}" ps -q);do
  [[ $(sudo docker inspect --format '{{.State.OOMKilled}}' "$id") = false ]]
done
sudo docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'
echo CI_RUNTIME_HEALTHY_UNDER_CONFIGURED_LIMITS_NO_REAL_EMAIL
