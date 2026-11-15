#!/bin/sh
set -eu
export MM_APP_PASSWORD="$(cat /run/secrets/app_db_password)"
export MM_MIGRATE_PASSWORD="$(cat /run/secrets/migrate_db_password)"
export MM_BACKUP_PASSWORD="$(cat /run/secrets/backup_db_password)"
psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password MM_APP_PASSWORD
\getenv migrate_password MM_MIGRATE_PASSWORD
\getenv backup_password MM_BACKUP_PASSWORD
CREATE ROLE mm_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT CONNECTION LIMIT 12;
CREATE ROLE mm_migrate LOGIN PASSWORD :'migrate_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT CONNECTION LIMIT 3;
CREATE ROLE mm_backup LOGIN PASSWORD :'backup_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT CONNECTION LIMIT 2;
CREATE SCHEMA mm_live AUTHORIZATION mm_migrate;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CONNECT ON DATABASE maison_miroir FROM PUBLIC;
GRANT CONNECT ON DATABASE maison_miroir TO mm_app, mm_migrate, mm_backup;
CREATE DATABASE maison_miroir_import OWNER mm_migrate;
REVOKE ALL ON DATABASE maison_miroir_import FROM PUBLIC;
GRANT CONNECT ON DATABASE maison_miroir_import TO mm_migrate;
\connect maison_miroir_import
CREATE SCHEMA mm_live AUTHORIZATION mm_migrate;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
\connect maison_miroir
GRANT USAGE ON SCHEMA mm_live TO mm_app, mm_backup;
ALTER ROLE mm_app SET search_path TO mm_live,pg_catalog;
ALTER ROLE mm_migrate SET search_path TO mm_live,pg_catalog;
ALTER ROLE mm_backup SET search_path TO mm_live,pg_catalog;
SET ROLE mm_migrate;
ALTER DEFAULT PRIVILEGES IN SCHEMA mm_live GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO mm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA mm_live GRANT USAGE,SELECT ON SEQUENCES TO mm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA mm_live GRANT SELECT ON TABLES TO mm_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA mm_live GRANT SELECT ON SEQUENCES TO mm_backup;
SQL
unset MM_APP_PASSWORD MM_MIGRATE_PASSWORD MM_BACKUP_PASSWORD
