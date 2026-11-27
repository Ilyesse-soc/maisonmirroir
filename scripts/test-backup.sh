#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
workspace="$PWD"
case "$(uname -s)" in
  MINGW*|MSYS*)
    workspace="$(cygpath -m "$PWD")"
    export MSYS_NO_PATHCONV=1
    ;;
esac
image="maison-miroir-backup-test"
docker build --tag "$image" -f ops/backup/Dockerfile .
docker run --rm --network none --user 0:0 --tmpfs /tmp:exec,size=256m \
  -v "$workspace/scripts/test-backup-entrypoint.sh:/test-backup-entrypoint.sh:ro" \
  --entrypoint sh "$image" /test-backup-entrypoint.sh
docker run --rm --network none --user 0:0 --tmpfs /tmp:exec,size=256m \
  -v "$workspace/scripts/test-backup-run.sh:/test-backup-run.sh:ro" \
  -v "$workspace/ops/backup/run.sh:/subject.sh:ro" \
  --entrypoint bash "$image" /test-backup-run.sh
docker run --rm --network none --tmpfs /tmp:exec,size=256m \
  -v "$workspace/scripts/test-backup-restore.sh:/test-backup-restore.sh:ro" \
  --entrypoint sh "$image" /test-backup-restore.sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-backup-alert.py
