#!/bin/bash
# Run only on the dedicated Ubuntu/Debian VPS after verifying its address and SSH host key.
set -euo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run as root on the dedicated VPS'; exit 1; }
if [[ "${1:-}" = --finalize-ssh ]];then
  [[ "${SUDO_USER:-}" = mmadmin && -n "${SSH_CONNECTION:-}" ]] || { echo 'Run from the verified mmadmin SSH session using sudo --preserve-env=SSH_CONNECTION';exit 1; }
  cat > /etc/ssh/sshd_config.d/00-maison-miroir.conf <<'SSH'
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
  sshd -T | grep -q '^passwordauthentication no$'
  sshd -T | grep -q '^kbdinteractiveauthentication no$'
  systemctl reload ssh || systemctl reload sshd
  echo KEY_ONLY_SSH_CONFIRMED_FROM_NEW_ADMIN_SESSION
  exit
fi
[[ -f /etc/os-release ]] || exit 1
source /etc/os-release
[[ "$ID" = ubuntu || "$ID" = debian ]] || { echo 'Unsupported OS';exit 1; }
: "${MM_ADMIN_PUBLIC_KEY_FILE:?Provide the operator SSH public-key file}"
: "${MM_DEPLOY_PUBLIC_KEY_FILE:?Provide the separate restricted CI public-key file}"
grep -Eq '^(ssh-ed25519|sk-ssh-ed25519@openssh.com) ' "$MM_ADMIN_PUBLIC_KEY_FILE"
grep -Eq '^(ssh-ed25519|sk-ssh-ed25519@openssh.com) ' "$MM_DEPLOY_PUBLIC_KEY_FILE"
apt-get update
apt-get install -y ca-certificates curl openssl gnupg ufw unattended-upgrades fail2ban python3 sudo certbot python3-certbot-dns-ovh
apt-get upgrade -y
# Official signed Docker repository; never remove an existing installation or its data implicitly.
if dpkg-query -W -f='${Status}' docker.io 2>/dev/null | grep -q 'install ok installed';then
  echo 'Existing distribution Docker detected; review it before switching repositories';exit 1
fi
install -d -m 0755 /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
fingerprint="$(gpg --show-keys --with-colons /etc/apt/keyrings/docker.asc | awk -F: '$1=="fpr"{print $10;exit}')"
[[ "$fingerprint" = 9DC858229FC7DD38854AE2D88D81803C0EBFCD88 ]] || { echo DOCKER_SIGNING_KEY_MISMATCH;exit 1; }
chmod 0644 /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/$ID
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
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
sshd -t
ufw default deny incoming
ufw default allow outgoing
while read -r ssh_port;do ufw allow "$ssh_port/tcp";done < <(sshd -T | awk '$1=="port"{print $2}')
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
timedatectl set-ntp true
install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
install -m 0755 /opt/maison-miroir/ops/install-certificate.sh /etc/letsencrypt/renewal-hooks/deploy/maison-miroir
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
echo 'Host prepared; existing SSH authentication retained. Connect separately as mmadmin, then run sudo --preserve-env=SSH_CONNECTION bash /opt/maison-miroir/ops/bootstrap-vps.sh --finalize-ssh. Keep the original session open until completion.'
