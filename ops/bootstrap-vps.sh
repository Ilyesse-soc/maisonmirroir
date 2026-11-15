#!/bin/bash
# Run only on the dedicated Ubuntu/Debian VPS after verifying its address and SSH host key.
set -euo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run as root on the dedicated VPS'; exit 1; }
[[ -f /etc/os-release ]] || exit 1
source /etc/os-release
[[ "$ID" = ubuntu || "$ID" = debian ]] || { echo 'Unsupported OS';exit 1; }
: "${MM_ADMIN_PUBLIC_KEY_FILE:?Provide the operator SSH public-key file}"
: "${MM_DEPLOY_PUBLIC_KEY_FILE:?Provide the separate restricted CI public-key file}"
grep -Eq '^(ssh-ed25519|sk-ssh-ed25519@openssh.com) ' "$MM_ADMIN_PUBLIC_KEY_FILE"
grep -Eq '^(ssh-ed25519|sk-ssh-ed25519@openssh.com) ' "$MM_DEPLOY_PUBLIC_KEY_FILE"
apt-get update
apt-get install -y ca-certificates curl openssl ufw unattended-upgrades fail2ban python3
# Use the distribution's maintained Docker/Compose packages; do not pipe a remote installer into a shell.
apt-get install -y docker.io docker-compose-v2 || { echo 'Install the official Docker apt repository for this OS, then rerun.';exit 1; }
systemctl enable --now docker fail2ban
install -d -m 0750 /opt/maison-miroir /opt/maison-miroir/ops
install -d -m 0700 /opt/maison-miroir/ops/secrets
install -d -o 1000 -g 1000 -m 0700 /opt/maison-miroir/ops/bootstrap
id mmadmin >/dev/null 2>&1 || useradd --create-home --shell /bin/bash mmadmin
usermod -aG sudo mmadmin
install -d -o mmadmin -g mmadmin -m 0700 /home/mmadmin/.ssh
install -o mmadmin -g mmadmin -m 0600 "$MM_ADMIN_PUBLIC_KEY_FILE" /home/mmadmin/.ssh/authorized_keys
# Key-only operator sudo; CI receives a separate restricted command and no generic Docker group access.
printf 'mmadmin ALL=(ALL) NOPASSWD: ALL\n' > /etc/sudoers.d/maison-miroir-admin
chmod 0440 /etc/sudoers.d/maison-miroir-admin
id mmdeploy >/dev/null 2>&1 || useradd --create-home --shell /bin/sh mmdeploy
install -d -o mmdeploy -g mmdeploy -m 0700 /home/mmdeploy/.ssh
{ printf 'restrict,command="/usr/local/sbin/mm-deploy-gateway" ';cat "$MM_DEPLOY_PUBLIC_KEY_FILE"; } > /home/mmdeploy/.ssh/authorized_keys
chown mmdeploy:mmdeploy /home/mmdeploy/.ssh/authorized_keys
chmod 0600 /home/mmdeploy/.ssh/authorized_keys
install -m 0755 /opt/maison-miroir/ops/deploy-gateway.sh /usr/local/sbin/mm-deploy-gateway
install -m 0755 /opt/maison-miroir/ops/release.sh /usr/local/sbin/mm-release
printf 'mmdeploy ALL=(root) NOPASSWD: /usr/local/sbin/mm-release\n' > /etc/sudoers.d/maison-miroir-deploy
chmod 0440 /etc/sudoers.d/maison-miroir-deploy
visudo -c
cat > /etc/ssh/sshd_config.d/70-maison-miroir.conf <<'SSH'
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
SSH
sshd -t
ufw default deny incoming
ufw default allow outgoing
ufw allow "${MM_SSH_PORT:-22}/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
systemctl reload ssh || systemctl reload sshd
install -d -m 0700 /var/lib/maison-miroir
install -m 0644 /opt/maison-miroir/ops/systemd/maison-miroir-monitor.service /etc/systemd/system/maison-miroir-monitor.service
install -m 0644 /opt/maison-miroir/ops/systemd/maison-miroir-monitor.timer /etc/systemd/system/maison-miroir-monitor.timer
install -d /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=150M\nRuntimeMaxUse=50M\nMaxRetentionSec=14day\n' > /etc/systemd/journald.conf.d/maison-miroir.conf
systemctl daemon-reload
systemctl enable --now maison-miroir-monitor.timer
systemctl restart systemd-journald
cat > /etc/apt/apt.conf.d/52-maison-miroir <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
Unattended-Upgrade::Automatic-Reboot "false";
APT
echo 'Host prepared. Verify a second key-only operator connection before closing the original SSH session.'
