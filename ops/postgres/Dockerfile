FROM postgres:19-alpine@sha256:cac45fb483caee3668946088a1c0532db89d5285c28dbfeac889b4068296e06f
RUN apk upgrade --no-cache libxml2
# Replace the legacy Go-built privilege switcher with Alpine's small maintained equivalent.
RUN apk add --no-cache su-exec
RUN rm -f /usr/local/bin/gosu
RUN ln -s /sbin/su-exec /usr/local/bin/gosu
