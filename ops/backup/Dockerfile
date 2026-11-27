FROM postgres:19-alpine@sha256:cac45fb483caee3668946088a1c0532db89d5285c28dbfeac889b4068296e06f
RUN apk upgrade --no-cache libxml2
RUN apk add --no-cache restic ca-certificates
RUN rm -f /usr/local/bin/gosu
COPY ops/backup/backup.sh /usr/local/bin/mm-backup
USER postgres
ENTRYPOINT ["/bin/sh","/usr/local/bin/mm-backup"]
