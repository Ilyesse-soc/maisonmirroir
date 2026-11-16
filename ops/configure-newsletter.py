#!/usr/bin/env python3
"""Root-only provisioning of missing values, supplied over encrypted SSH stdin."""
import json, os, pathlib, re, shutil, sys, time
if os.geteuid() != 0:
    raise SystemExit('ROOT_REQUIRED')
config = json.load(sys.stdin)
allowed = {'RESEND_API_KEY','EMAIL_FROM','ADMIN_EMAIL','RESEND_NEWSLETTER_WEBHOOK_SECRET'}
if set(config) != allowed or any(not isinstance(v,str) or not v or '\n' in v or '\r' in v for v in config.values()):
    raise SystemExit('INVALID_PROVISIONING_INPUT')
if not config['RESEND_API_KEY'].startswith('re_') or not config['RESEND_NEWSLETTER_WEBHOOK_SECRET'].startswith('whsec_'):
    raise SystemExit('INVALID_PROVIDER_CREDENTIAL_FORMAT')
path = pathlib.Path('/opt/maison-miroir/ops/secrets/app.env')
original = path.read_text()
lines = original.splitlines()
values = {}
for line in lines:
    if '=' in line and not line.lstrip().startswith('#'):
        key,value=line.split('=',1)
        try: values[key]=json.loads(value)
        except (ValueError,TypeError): values[key]=value.strip().strip('"').strip("'")
if values.get('SHOP_OPEN') == 'true': raise SystemExit('SHOP_MUST_REMAIN_CLOSED')
for key,value in config.items():
    if values.get(key) and values[key] != value:
        raise SystemExit('REFUSING_TO_REPLACE_EXISTING_CONFIGURATION')
updates={k:v for k,v in config.items() if not values.get(k)}
updates['NEWSLETTER_SEND_ENABLED']='true'
backup=pathlib.Path('/var/lib/maison-miroir/config-backups')/str(int(time.time()))
backup.mkdir(parents=True,mode=0o700)
shutil.copy2(path,backup/'app.env');os.chmod(backup/'app.env',0o600)
result=[]
for line in lines:
    key=line.split('=',1)[0]
    if key in updates:
        result.append(key+'='+json.dumps(updates.pop(key),ensure_ascii=False))
    else: result.append(line)
result += [k+'='+json.dumps(v,ensure_ascii=False) for k,v in updates.items()]
path.write_text('\n'.join(result)+'\n')
os.chmod(path,0o600)
print('MISSING_NEWSLETTER_CONFIGURATION_INSTALLED_NO_SECRET_PRINTED')
