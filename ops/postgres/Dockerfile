FROM postgres:18-alpine@sha256:0115267ab5a509022df9319c77be365cef335adb71556c75f60f5360ee247e71
# Replace the legacy Go-built privilege switcher with Alpine's small maintained equivalent.
RUN apk add --no-cache su-exec
RUN rm -f /usr/local/bin/gosu
RUN ln -s /sbin/su-exec /usr/local/bin/gosu
