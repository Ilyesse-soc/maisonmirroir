#!/bin/bash
set -euo pipefail
umask 077
cd /opt/maison-miroir/ops
if [[ -d secrets ]] && find secrets -mindepth 1 -maxdepth 1 -type f ! -name '*.example' -print -quit | grep -q .; then
  echo 'Existing secrets retained; refusing to overwrite (including partial initialization)'; exit 1
fi
install -d -m 0700 secrets
for name in postgres_password app_db_password migrate_db_password backup_db_password restic_password;do
  openssl rand -hex 40 > "secrets/$name"
  chown 70:70 "secrets/$name"
  chmod 0400 "secrets/$name"
done
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out secrets/db-ca.key
openssl req -x509 -new -sha256 -days 3650 -key secrets/db-ca.key -out secrets/db-ca.crt -subj '/CN=Maison Miroir database CA'
openssl req -new -newkey rsa:2048 -nodes -keyout secrets/db-server.key -out secrets/db-server.csr -subj '/CN=postgres'
printf 'subjectAltName=DNS:postgres\nextendedKeyUsage=serverAuth\n' > secrets/db-server.ext
openssl x509 -req -days 825 -sha256 -in secrets/db-server.csr -CA secrets/db-ca.crt -CAkey secrets/db-ca.key -CAcreateserial -out secrets/db-server.crt -extfile secrets/db-server.ext
chown 70:70 secrets/db-server.key
chmod 0400 secrets/db-server.key
chmod 0444 secrets/db-server.crt secrets/db-ca.crt
app_password="$(cat secrets/app_db_password)"
migration_password="$(cat secrets/migrate_db_password)"
cat > secrets/app.env <<EOF
NODE_ENV=production
NEWSLETTER_DATABASE_URL=postgresql://mm_app:$app_password@postgres:5432/maison_miroir?mm_schema=mm_live
NEWSLETTER_SITE_URL=https://maison-miroir.fr
BETTER_AUTH_URL=https://maison-miroir.fr
BETTER_AUTH_SECRET=$(openssl rand -hex 48)
NEWSLETTER_HASH_SECRET=$(openssl rand -hex 48)
NEWSLETTER_WORKER_SECRET=$(openssl rand -hex 48)
CRON_SECRET=$(openssl rand -hex 48)
SHOP_OPEN=false
NEWSLETTER_AUTO_PUBLISH=false
NEWSLETTER_SEND_ENABLED=false
NEWSLETTER_DAILY_CONFIRMATION_LIMIT=100
NEWSLETTER_RETENTION_DAYS=1095
EOF
printf 'NEWSLETTER_DATABASE_URL=postgresql://mm_migrate:%s@postgres:5432/maison_miroir?mm_schema=mm_live\n' "$migration_password" > secrets/migrate.env
chmod 0600 secrets/app.env secrets/migrate.env
echo 'Local secrets created. Add the existing Resend sender/key and owner contact securely; no secret value was printed.'
