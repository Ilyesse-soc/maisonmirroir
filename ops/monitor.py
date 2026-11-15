#!/usr/bin/env python3
"""Host-only checks. Fixed metrics, no customer data, no mounted Docker socket in an app container."""
import datetime, html, json, os, pathlib, subprocess, time, urllib.request
ROOT = pathlib.Path('/opt/maison-miroir/ops')
STATE = pathlib.Path('/var/lib/maison-miroir/monitor-state.json')
problems = []
memory = {}
for line in pathlib.Path('/proc/meminfo').read_text().splitlines():
    key, value = line.split(':', 1)
    memory[key] = int(value.strip().split()[0])
if memory['MemAvailable'] < 400 * 1024: problems.append('Mémoire disponible inférieure à 400 Mio')
disk = os.statvfs('/opt/maison-miroir')
if disk.f_bavail / disk.f_blocks < 0.20: problems.append('Moins de 20 % de disque disponible')
if os.getloadavg()[1] > 3: problems.append('Charge CPU soutenue élevée')
command = ['docker', 'compose', '--env-file', str(ROOT / '.env'), '-f', str(ROOT / 'compose.yml')]
ids = subprocess.check_output(command + ['ps', '-q'], text=True).split()
if not ids: problems.append('Aucun conteneur applicatif actif')
for identifier in ids:
    raw = subprocess.check_output(['docker', 'inspect', '--format', '{{json .State}}', identifier], text=True)
    state = json.loads(raw)
    if not state.get('Running') or state.get('OOMKilled') or state.get('Health', {}).get('Status') == 'unhealthy':
        problems.append('Un service est arrêté, sans mémoire ou en échec de healthcheck')
try:
    count = subprocess.check_output(command + ['exec', '-T', '--user', 'postgres', 'postgres', 'psql', '-U', 'postgres', '-d', 'maison_miroir', '-At', '-c', "SELECT (SELECT count(*) FROM mm_live.mm_jobs WHERE status IN ('failed','rejected','review') AND updated_at>now()-interval '1 hour')+(SELECT count(*) FROM mm_live.mm_cart_reminders WHERE status IN ('failed','rejected','review') AND updated_at>now()-interval '1 hour')"], text=True, stderr=subprocess.DEVNULL).strip()
    if int(count) > 0: problems.append('Des envois e-mail ont échoué ou nécessitent une vérification')
    logs = subprocess.check_output(command + ['logs', '--since', '5m', '--no-log-prefix', 'app', 'worker', 'backup'], text=True, stderr=subprocess.DEVNULL)
    if 'WEBHOOK_PROCESSING_FAILED' in logs: problems.append('Le traitement des événements e-mail a échoué')
    if 'BACKUP_FAILED' in logs: problems.append('La sauvegarde externe a échoué')
except (subprocess.CalledProcessError, ValueError):
    problems.append('Vérification de PostgreSQL ou des services techniques impossible')
config_file = ROOT / 'secrets' / 'monitor.json'
config = json.loads(config_file.read_text()) if config_file.exists() else {}
STATE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
previous = json.loads(STATE.read_text()) if STATE.exists() else {'failures': 0, 'last_alert': 0}
current = {'failures': previous['failures'] + 1 if problems else 0, 'last_alert': previous['last_alert']}
if current['failures'] >= 3 and time.time() - previous['last_alert'] >= 3600:
    if config.get('enabled') and all(config.get(k) for k in ['resend_key', 'from', 'to']):
        payload = json.dumps({'from': config['from'], 'to': config['to'], 'subject': 'Maison Miroir — incident serveur', 'html': '<h1>Vérification du VPS nécessaire</h1><ul>' + ''.join('<li>' + html.escape(p) + '</li>' for p in sorted(set(problems))) + '</ul>'}).encode()
        request = urllib.request.Request('https://api.resend.com/emails', data=payload, headers={'Authorization': 'Bearer ' + config['resend_key'], 'Content-Type': 'application/json', 'Idempotency-Key': 'incident-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H')})
        with urllib.request.urlopen(request, timeout=10) as response:
            if response.status not in (200, 201): raise RuntimeError('ALERT_REQUEST_REJECTED')
        current['last_alert'] = time.time()
        print('ALERT_ACCEPTED_BY_PROVIDER')
    else:
        print('ALERT_DELIVERY_NOT_CONFIGURED')
STATE.write_text(json.dumps(current))
STATE.chmod(0o600)
print(json.dumps({'code': 'HOST_CHECK', 'issues': len(set(problems)), 'consecutive_failures': current['failures']}))
