#!/bin/sh
set -eu
# No eval, shell interpolation of a supplied command, arbitrary image, or arbitrary sudo command.
case "${SSH_ORIGINAL_COMMAND:-}" in 'deploy sha256:'*) ;; *) exit 64;; esac
digest="${SSH_ORIGINAL_COMMAND#deploy }"
printf '%s' "$digest" | grep -Eq '^sha256:[a-f0-9]{64}$' || exit 64
exec sudo -n /usr/local/sbin/mm-release "$digest"
