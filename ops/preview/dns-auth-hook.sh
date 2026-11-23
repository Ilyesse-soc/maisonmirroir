#!/usr/bin/env bash
set -euo pipefail
umask 077

domain="${CERTBOT_DOMAIN:?Certbot domain is required}"
validation="${CERTBOT_VALIDATION:?Certbot validation value is required}"
[[ "$domain" = preview.maison-miroir.fr ]]

root=/opt/maison-miroir-preview
printf '%s\n' "$domain" > "$root/dns-domain.next"
printf '%s\n' "$validation" > "$root/dns-validation.next"
mv "$root/dns-domain.next" "$root/dns-domain"
mv "$root/dns-validation.next" "$root/dns-validation"

deadline=$((SECONDS + 21600))
while [[ ! -f "$root/dns-validation-confirmed" ]]; do
  (( SECONDS < deadline )) || { echo DNS_VALIDATION_CONFIRMATION_TIMEOUT >&2; exit 1; }
  sleep 5
done
rm -f "$root/dns-validation-confirmed"
