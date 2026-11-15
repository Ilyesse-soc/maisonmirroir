FROM postgres:18-alpine@sha256:b6972e1115a4ff8eba5d7f7d19184926d1e16d7d1136ae1e1a7ebf286da0f015
RUN apk add --no-cache restic ca-certificates
COPY ops/backup/backup.sh /usr/local/bin/mm-backup
USER postgres
ENTRYPOINT ["/bin/sh","/usr/local/bin/mm-backup"]
