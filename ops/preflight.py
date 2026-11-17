#!/usr/bin/env python3
"""Deployment gates; never print a secret value or modify a source database."""
import json, pathlib, re, stat, subprocess
ROOT = pathlib.Path('/opt/maison-miroir/ops')
def env(path):
    result = {}
    for line in path.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            result[key] = value.strip().strip('"').strip("'")
    return result
config = env(ROOT / '.env')
app = env(ROOT / 'secrets' / 'app.env')
required = ['NEWSLETTER_DATABASE_URL','NEWSLETTER_SITE_URL','BETTER_AUTH_URL','BETTER_AUTH_SECRET','NEWSLETTER_HASH_SECRET','NEWSLETTER_WORKER_SECRET','ADMIN_EMAIL']
for key in required:
    if not app.get(key) or re.search(r'REPLACE|PROVIDE|GENERATE_', app[key]): raise RuntimeError('MISSING_REQUIRED_CONFIGURATION_' + key)
if len(app['BETTER_AUTH_SECRET']) < 32: raise RuntimeError('AUTH_SECRET_TOO_SHORT')
if not app['NEWSLETTER_DATABASE_URL'].startswith('postgresql://mm_app:'): raise RuntimeError('PRIVILEGED_DATABASE_ROLE_FORBIDDEN')
if not app['NEWSLETTER_SITE_URL'].startswith('https://') or app['BETTER_AUTH_URL'] != app['NEWSLETTER_SITE_URL']: raise RuntimeError('PUBLIC_HTTPS_ORIGIN_REQUIRED')
for file in ['app.env','migrate.env','postgres_password','app_db_password','migrate_db_password','backup_db_password','db-server.key']:
    path = ROOT / 'secrets' / file
    if not path.is_file() or path.stat().st_mode & stat.S_IRWXO: raise RuntimeError('SECRET_FILE_PERMISSIONS_UNSAFE')
if config.get('PROXY_TLS_MODE') not in ('staging', 'production'): raise RuntimeError('PROXY_TLS_MODE_REQUIRED')
if config.get('PROXY_TLS_MODE') == 'production':
    certificate = str(ROOT/'secrets'/'tls'/'server.crt')
    for hostname in ['maison-miroir.fr', 'www.maison-miroir.fr']:
        subprocess.run(['openssl','verify','-CApath','/etc/ssl/certs','-untrusted',certificate,'-verify_hostname',hostname,certificate], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['openssl','x509','-in',certificate,'-noout','-checkend','86400'], check=True, stdout=subprocess.DEVNULL)
    for key in ['RESEND_API_KEY','EMAIL_FROM','RESEND_NEWSLETTER_WEBHOOK_SECRET']:
        if not app.get(key): raise RuntimeError('EMAIL_CONFIGURATION_REQUIRED_' + key)
    if app.get('NEWSLETTER_SEND_ENABLED') != 'true': raise RuntimeError('NEWSLETTER_STILL_PAUSED')
    if not config.get('RESTIC_REPOSITORY','').startswith('s3:https://') or 'REPLACE' in config['RESTIC_REPOSITORY']: raise RuntimeError('EXTERNAL_BACKUP_NOT_CONFIGURED')
    for file in ['restic_password','s3_access_key','s3_secret_key']:
        if not (ROOT/'secrets'/file).is_file(): raise RuntimeError('EXTERNAL_BACKUP_CREDENTIALS_MISSING')
    report = json.loads((ROOT/'migration'/'final-report.json').read_text())
    if report.get('stage') != 'final' or report.get('passed') is not True or report.get('errors') != 0 or report.get('differences') != 0: raise RuntimeError('VERIFIED_ORDER_IMPORT_REQUIRED')
    restore = json.loads((ROOT/'migration'/'restore-verified.json').read_text())
    if restore.get('passed') is not True or not restore.get('snapshot') or not restore.get('verifiedAt'): raise RuntimeError('EXTERNAL_BACKUP_RESTORE_VERIFICATION_REQUIRED')
print('DEPLOYMENT_PREFLIGHT_PASSED')
