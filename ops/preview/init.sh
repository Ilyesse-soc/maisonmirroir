#!/bin/sh
set -eu
export PREVIEW_APP_PASSWORD="$(cat /run/secrets/app-db-password)"
export PREVIEW_MIGRATE_PASSWORD="$(cat /run/secrets/migrate-db-password)"
psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password PREVIEW_APP_PASSWORD
\getenv migrate_password PREVIEW_MIGRATE_PASSWORD
CREATE ROLE mm_preview_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT CONNECTION LIMIT 8;
CREATE ROLE mm_preview_migrate LOGIN PASSWORD :'migrate_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT CONNECTION LIMIT 2;
CREATE SCHEMA mm_preview AUTHORIZATION mm_preview_migrate;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CONNECT ON DATABASE maison_miroir_preview FROM PUBLIC;
GRANT CONNECT ON DATABASE maison_miroir_preview TO mm_preview_app, mm_preview_migrate;
GRANT USAGE ON SCHEMA mm_preview TO mm_preview_app;
ALTER ROLE mm_preview_app SET search_path TO mm_preview,pg_catalog;
ALTER ROLE mm_preview_migrate SET search_path TO mm_preview,pg_catalog;
SET ROLE mm_preview_migrate;
ALTER DEFAULT PRIVILEGES IN SCHEMA mm_preview GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO mm_preview_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA mm_preview GRANT USAGE,SELECT ON SEQUENCES TO mm_preview_app;
SQL
unset PREVIEW_APP_PASSWORD PREVIEW_MIGRATE_PASSWORD
