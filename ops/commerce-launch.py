#!/usr/bin/env python3
"""Prepare or open the existing production stack without exposing credentials.

Run with sudo python3 ops/commerce-launch.py --prepare or --open.
No payment, label, email, migration, or image build is performed.
"""
import argparse
import base64
import datetime
import fcntl
import json
import os
import pathlib
import shutil
import subprocess
import urllib.request

ROOT = pathlib.Path('/opt/maison-miroir/ops')
COMPOSE = ['docker', 'compose', '--env-file', str(ROOT / '.env'), '-f', str(ROOT / 'compose.yml')]


def run(args, **kwargs):
    return subprocess.check_output(args, **kwargs)


def sql(statement):
    return run(['docker', 'exec', '-u', 'postgres', 'maison-miroir-postgres-1',
                'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d',
                'maison_miroir', '-At', '-c', statement], text=True).strip()


def read_env(path):
    result = {}
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        key, value = line.split('=', 1)
        if key in result:
            raise RuntimeError('DUPLICATE_KEY_' + key)
        result[key] = value.strip().strip('"').strip("'")
    return result


def public_config():
    with urllib.request.urlopen('https://maison-miroir.fr/api/shipping/config', timeout=20) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--open', action='store_true')
    args = parser.parse_args()
    if args.prepare == args.open:
        parser.error('Choose exactly one of --prepare or --open')
    if os.geteuid() != 0:
        raise RuntimeError('EXISTING_SUDO_ACCESS_REQUIRED')
    os.umask(0o077)
    release_lock = open('/run/maison-miroir-release.lock', 'w')
    fcntl.flock(release_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    path = ROOT / 'secrets/app.env'
    env = read_env(path)
    resolved = json.loads(run(COMPOSE + ['config', '--no-env-resolution', '--format', 'json'], text=True))
    for service in ['app', 'worker']:
        spec = resolved['services'][service]
        files = [x['path'] if isinstance(x, dict) else x for x in spec.get('env_file', [])]
        if [str(pathlib.Path(x).resolve()) for x in files] != [str(path)]:
            raise RuntimeError('UNEXPECTED_ENV_FILE_' + service)
        for key, value in spec.get('environment', {}).items():
            if key.startswith(('PAYPAL_', 'MONDIAL_RELAY_', 'REAL_', 'SHOP_OPEN')) and key in env and str(value) != env[key]:
                raise RuntimeError('ENVIRONMENT_OVERRIDE_' + key)
        container = json.loads(run(['docker', 'inspect', 'maison-miroir-' + service + '-1'], text=True))[0]
        if container['Config']['Labels']['com.docker.compose.project.config_files'] != str(ROOT / 'compose.yml'):
            raise RuntimeError('UNEXPECTED_COMPOSE_FILES_' + service)
    for key in ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_MERCHANT_ID',
                'PAYPAL_WEBHOOK_ID', 'MONDIAL_RELAY_API1_PROD_SHOP', 'MONDIAL_RELAY_API1_PROD_PRIVATE_KEY',
                'RESEND_API_KEY', 'EMAIL_FROM']:
        if not env.get(key):
            raise RuntimeError('MISSING_' + key)
    if env.get('PAYPAL_ENV') != 'production':
        raise RuntimeError('PAYPAL_LIVE_REQUIRED')
    auth = base64.b64encode((env['PAYPAL_CLIENT_ID'] + ':' + env['PAYPAL_CLIENT_SECRET']).encode()).decode()
    request = urllib.request.Request('https://api-m.paypal.com/v1/oauth2/token',
        data=b'grant_type=client_credentials', headers={'Authorization': 'Basic ' + auth})
    with urllib.request.urlopen(request, timeout=15) as response:
        token = json.load(response)['access_token']
    request = urllib.request.Request('https://api-m.paypal.com/v1/notifications/webhooks/' + env['PAYPAL_WEBHOOK_ID'],
        headers={'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(request, timeout=15) as response:
        webhook = json.load(response)
    if webhook.get('url') != 'https://maison-miroir.fr/api/paypal/webhook' or not any(
        event['name'] in ['*', 'PAYMENT.CAPTURE.COMPLETED'] for event in webhook.get('event_types', [])):
        raise RuntimeError('PAYPAL_WEBHOOK_INVALID')
    with urllib.request.urlopen('https://maison-miroir.fr/api/shipping/mondial-relay/points?postalCode=78300&quantity=1', timeout=20) as response:
        points = json.load(response)
    if points.get('source') != 'production' or not points.get('points') or not all(p.get('proof') for p in points['points']):
        raise RuntimeError('REAL_API1_SEARCH_REQUIRED')
    print('PAYPAL_LIVE_AND_REAL_API1_VERIFIED')
    if args.open:
        ready = sql("""SELECT json_build_object(
          'connect',COALESCE((settings->>'manualConnectConfirmed')::boolean,false) AND settings->>'fulfillmentMode'='manual_connect',
          'sender',NOT EXISTS (SELECT 1 FROM unnest(ARRAY['firstName','lastName','street','postalCode','city','countryCode','phone','email']) k WHERE COALESCE(settings->'sender'->>k,'')=''),
          'legal',NOT EXISTS (SELECT 1 FROM unnest(ARRAY['legal_seller_name','professional_phone','mediator_name','mediator_address','mediator_url']) k WHERE NOT EXISTS (SELECT 1 FROM mm_live.mm_brand_settings b WHERE b.key=k AND length(trim(b.value))>0))
            AND EXISTS (SELECT 1 FROM mm_live.mm_brand_settings WHERE key='legal_terms_confirmed' AND value='true'))
          FROM mm_live.mm_shipping_settings WHERE id=1""")
        readiness = json.loads(ready) if ready else {}
        # Manual Connect uses the sender profile verified in Connect. Keep the
        # application sender diagnostic, without imposing an API2 prerequisite.
        mandatory = ['connect', 'legal']
        if not readiness or not all(readiness.get(key) for key in mandatory):
            raise RuntimeError('PENDING_CONFIRMATIONS_' + ','.join(k for k in mandatory if not readiness.get(k)))
        config = public_config()
        if not all(config.get(k) for k in ['paymentsEnabled', 'realShippingEnabled', 'manualShippingReady', 'fulfillmentReady']):
            raise RuntimeError('CHECKOUT_NOT_READY')
    backup = ROOT / 'backups' / ('commerce-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(parents=True, mode=0o700)
    for item in [path, ROOT / '.env', ROOT / 'compose.yml', ROOT / 'release.sh']:
        shutil.copy2(item, backup / item.name)
    with (backup / 'database.dump').open('wb') as stream:
        subprocess.run(['docker', 'exec', '-u', 'postgres', 'maison-miroir-postgres-1',
                        'pg_dump', '-U', 'postgres', '-d', 'maison_miroir', '-Fc'], stdout=stream, check=True)
    print('SECURE_BACKUP', str(backup))
    if args.prepare:
        updates = {
            'shippingTiers': [dict(quantity=1, weightGrams=500, lengthCm=30, widthCm=21, depthCm=6, customerPriceCents=410, confirmed=True),
                              dict(quantity=2, weightGrams=1000, lengthCm=None, widthCm=None, depthCm=None, customerPriceCents=454, confirmed=False)],
            'preparationDays': 3,
        }
        initial = dict(updates, fulfillmentMode='manual_connect', manualConnectConfirmed=False)
        sql("BEGIN; INSERT INTO mm_live.mm_shipping_settings(id,settings,updated_by) VALUES(1,'" + json.dumps(initial) + "','commercial-preparation') ON CONFLICT(id) DO UPDATE SET settings=mm_live.mm_shipping_settings.settings || '" + json.dumps(updates) + "'::jsonb,updated_at=now(); COMMIT;")
    changes = {'REAL_PAYMENTS_ENABLED': 'true', 'REAL_SHIPPING_ENABLED': 'true', 'MONDIAL_RELAY_API1_PROD_ENABLED': 'true'}
    if args.open:
        changes['SHOP_OPEN'] = 'true'
    lines = path.read_text().splitlines()
    for key, value in changes.items():
        if key in env:
            lines = [key + '=' + value if line.startswith(key + '=') else line for line in lines]
        else:
            lines.append(key + '=' + value)
    # Write in place: ownership and existing permissions are preserved.
    path.write_text('\n'.join(lines) + '\n')
    try:
        subprocess.run(COMPOSE + ['up', '-d', '--no-deps', '--no-build', '--force-recreate', '--wait', '--wait-timeout', '150', 'app', 'worker'], check=True)
        config = public_config()
        if not config.get('paymentsEnabled') or (args.open and not config.get('shopOpen')):
            raise RuntimeError('PUBLIC_VERIFICATION_FAILED')
    except Exception:
        shutil.copy2(backup / 'app.env', path)
        subprocess.run(COMPOSE + ['up', '-d', '--no-deps', '--no-build', '--force-recreate', '--wait', '--wait-timeout', '150', 'app', 'worker'], check=True)
        raise
    print(json.dumps({k: config.get(k) for k in ['shopOpen', 'paymentsEnabled', 'realShippingEnabled', 'manualShippingReady', 'fulfillmentReady']}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Never expose HTTP response bodies, environment values or SQL records.
        print('LAUNCH_STOPPED', type(error).__name__, str(error) if isinstance(error, RuntimeError) else '')
        raise SystemExit(1)
