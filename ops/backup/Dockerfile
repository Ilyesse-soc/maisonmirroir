FROM postgres:18-alpine@sha256:0115267ab5a509022df9319c77be365cef335adb71556c75f60f5360ee247e71
RUN apk upgrade --no-cache libxml2
RUN apk add --no-cache restic ca-certificates
RUN rm -f /usr/local/bin/gosu
COPY ops/backup/backup.sh /usr/local/bin/mm-backup
USER postgres
ENTRYPOINT ["/bin/sh","/usr/local/bin/mm-backup"]
