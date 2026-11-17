FROM postgres:18-alpine@sha256:b6972e1115a4ff8eba5d7f7d19184926d1e16d7d1136ae1e1a7ebf286da0f015
# Replace the legacy Go-built privilege switcher with Alpine's small maintained equivalent.
RUN apk add --no-cache su-exec
RUN rm -f /usr/local/bin/gosu
RUN ln -s /sbin/su-exec /usr/local/bin/gosu
