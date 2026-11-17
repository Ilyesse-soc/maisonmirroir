#!/bin/bash
# Certbot deploy hook; DNS-01 obtains certificates before any web DNS switch.
set -euo pipefail
[[ $EUID -eq 0 ]] || exit 1
lineage="${RENEWED_LINEAGE:-/etc/letsencrypt/live/maison-miroir.fr}"
[[ "$lineage" = /etc/letsencrypt/live/maison-miroir.fr ]] || exit 1
openssl x509 -in "$lineage/fullchain.pem" -noout -checkhost maison-miroir.fr
openssl x509 -in "$lineage/fullchain.pem" -noout -checkhost www.maison-miroir.fr
openssl x509 -in "$lineage/fullchain.pem" -noout -checkend 86400
target=/opt/maison-miroir/ops/secrets/tls
install -d -o 101 -g 101 -m 0750 "$target"
install -o 101 -g 101 -m 0440 "$lineage/fullchain.pem" "$target/server.crt.next"
install -o 101 -g 101 -m 0400 "$lineage/privkey.pem" "$target/server.key.next"
cert_public="$(openssl x509 -in "$target/server.crt.next" -pubkey -noout | openssl sha256)"
key_public="$(openssl pkey -in "$target/server.key.next" -pubout | openssl sha256)"
[[ "$cert_public" = "$key_public" ]] || { echo CERTIFICATE_KEY_MISMATCH;exit 1; }
mv "$target/server.crt.next" "$target/server.crt"
mv "$target/server.key.next" "$target/server.key"
cd /opt/maison-miroir/ops
if docker compose --env-file .env ps --status running -q proxy | grep -q .;then
  docker compose --env-file .env exec -T proxy nginx -t
  docker compose --env-file .env exec -T proxy nginx -s reload
fi
echo CERTIFICATE_INSTALLED_NO_KEY_PRINTED
