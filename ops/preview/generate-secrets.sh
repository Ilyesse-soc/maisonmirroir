#!/bin/bash
set -euo pipefail
umask 077
root="${PREVIEW_ROOT:-/opt/maison-miroir-preview}"
admin_email="${PREVIEW_ADMIN_EMAIL:?Set PREVIEW_ADMIN_EMAIL to the approved administrator address}"
[[ "$admin_email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || exit 64
cd "$root"
if [[ -d secrets ]] && find secrets -mindepth 1 -maxdepth 1 -type f -print -quit | grep -q .; then
  echo "Existing preview secrets retained; refusing to overwrite"; exit 1
fi
install -d -m 0700 secrets
install -d -o 1000 -g 1000 -m 0700 bootstrap
for name in postgres-password app-db-password migrate-db-password; do
  openssl rand -hex 40 > "secrets/$name"
  chown 70:70 "secrets/$name"
  chmod 0400 "secrets/$name"
done
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out secrets/db-ca.key
openssl req -x509 -new -sha256 -days 3650 -key secrets/db-ca.key -out secrets/db-ca.crt -subj '/CN=Maison Miroir preview database CA'
openssl req -new -newkey rsa:2048 -nodes -keyout secrets/db-server.key -out secrets/db-server.csr -subj '/CN=postgres'
printf 'subjectAltName=DNS:postgres\nextendedKeyUsage=serverAuth\n' > secrets/db-server.ext
openssl x509 -req -days 825 -sha256 -in secrets/db-server.csr -CA secrets/db-ca.crt -CAkey secrets/db-ca.key -CAcreateserial -out secrets/db-server.crt -extfile secrets/db-server.ext
chown 70:70 secrets/db-server.key
chmod 0400 secrets/db-server.key
chmod 0444 secrets/db-server.crt secrets/db-ca.crt
chmod 0400 secrets/db-ca.key

app_password="$(cat secrets/app-db-password)"
migrate_password="$(cat secrets/migrate-db-password)"
auth_secret="$(openssl rand -hex 48)"
hash_secret="$(openssl rand -hex 48)"
worker_secret="$(openssl rand -hex 48)"
cat > secrets/app.env <<EOF
NEWSLETTER_DATABASE_URL=postgresql://mm_preview_app:${app_password}@postgres:5432/maison_miroir_preview?mm_schema=mm_preview
NEWSLETTER_SITE_URL=https://preview.maison-miroir.fr:9443
BETTER_AUTH_URL=https://preview.maison-miroir.fr:9443
BETTER_AUTH_SECRET=${auth_secret}
NEWSLETTER_HASH_SECRET=${hash_secret}
NEWSLETTER_WORKER_SECRET=${worker_secret}
ADMIN_EMAIL=${admin_email}
EMAIL_ADMIN=${admin_email}
NEWSLETTER_SEND_ENABLED=false
SHOP_OPEN=false
EOF
cat > secrets/migrate.env <<EOF
NEWSLETTER_DATABASE_URL=postgresql://mm_preview_migrate:${migrate_password}@postgres:5432/maison_miroir_preview?mm_schema=mm_preview
NEWSLETTER_SITE_URL=https://preview.maison-miroir.fr:9443
BETTER_AUTH_URL=https://preview.maison-miroir.fr:9443
BETTER_AUTH_SECRET=${auth_secret}
ADMIN_EMAIL=${admin_email}
EOF
unset app_password migrate_password auth_secret hash_secret worker_secret
chmod 0600 secrets/app.env secrets/migrate.env
rm -f -- secrets/db-server.csr secrets/db-server.ext secrets/db-ca.srl
echo "Preview-only database and authentication secrets created. Email delivery credentials were not configured."
