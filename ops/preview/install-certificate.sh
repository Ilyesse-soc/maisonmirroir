#!/usr/bin/env bash
set -euo pipefail
umask 077

lineage="${RENEWED_LINEAGE:?Certbot renewal lineage is required}"
expected=/opt/maison-miroir-preview/certbot/live/preview.maison-miroir.fr
[[ "$lineage" = "$expected" ]]

openssl x509 -in "$lineage/fullchain.pem" -noout -checkhost preview.maison-miroir.fr
openssl x509 -in "$lineage/fullchain.pem" -noout -checkend 86400

target=/opt/maison-miroir-preview/tls
install -o root -g 101 -m 0440 "$lineage/fullchain.pem" "$target/fullchain.pem.next"
install -o root -g 101 -m 0440 "$lineage/privkey.pem" "$target/privkey.pem.next"

cert_public="$(openssl x509 -in "$target/fullchain.pem.next" -pubkey -noout | openssl sha256)"
key_public="$(openssl pkey -in "$target/privkey.pem.next" -pubout | openssl sha256)"
[[ "$cert_public" = "$key_public" ]]

mv "$target/fullchain.pem.next" "$target/fullchain.pem"
mv "$target/privkey.pem.next" "$target/privkey.pem"

if docker inspect maison-miroir-preview-nginx >/dev/null 2>&1 &&
  [[ "$(docker inspect --format '{{.State.Running}}' maison-miroir-preview-nginx)" = true ]]; then
  docker exec maison-miroir-preview-nginx nginx -t
  docker exec maison-miroir-preview-nginx nginx -s reload
fi

echo PREVIEW_CERTIFICATE_INSTALLED
