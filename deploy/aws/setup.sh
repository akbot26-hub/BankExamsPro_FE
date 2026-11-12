#!/usr/bin/env bash
# BankExamsPro — one-shot setup for a fresh Ubuntu 24 VM (EC2 t3.micro or Lightsail).
# Run as a sudo-capable user from the repo root uploaded to the VM:
#   sudo bash deploy/aws/setup.sh yourdomain.com     # domain optional
set -euo pipefail

DOMAIN="${1:-_}"
APP_DIR=/opt/bankexamspro
RUN_USER=bankexams

echo "==> System packages"
apt-get update -qq
apt-get install -y -qq nginx curl ca-certificates rsync > /dev/null

echo "==> Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null
  apt-get install -y -qq nodejs > /dev/null
fi
node -v

echo "==> App user and directory"
id -u $RUN_USER &>/dev/null || useradd --system --home $APP_DIR --shell /usr/sbin/nologin $RUN_USER
mkdir -p $APP_DIR
rsync -a --exclude node_modules --exclude client/node_modules --exclude client/dist ./ $APP_DIR/

echo "==> Install and build"
cd $APP_DIR/server && npm install --omit=dev --silent
cd $APP_DIR/client && npm install --silent && npm run build

echo "==> Seed only if no database exists (redeploys must never wipe student data)"
if [ ! -f $APP_DIR/server/data/db.json ]; then
  cd $APP_DIR/server && npm run seed
else
  echo "    existing db.json found — keeping it"
fi

echo "==> JWT secret (generated once, kept across deploys)"
ENV_FILE=/etc/bankexamspro.env
if [ ! -f $ENV_FILE ]; then
  echo "JWT_SECRET=$(head -c 32 /dev/urandom | base64)" > $ENV_FILE
  echo "PORT=4000" >> $ENV_FILE
  chmod 600 $ENV_FILE
fi

chown -R $RUN_USER:$RUN_USER $APP_DIR

echo "==> systemd service"
cp $APP_DIR/deploy/aws/bankexamspro.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now bankexamspro
systemctl restart bankexamspro

echo "==> nginx"
sed "s/SERVER_NAME/$DOMAIN/" $APP_DIR/deploy/aws/nginx.conf > /etc/nginx/sites-available/bankexamspro
ln -sf /etc/nginx/sites-available/bankexamspro /etc/nginx/sites-enabled/bankexamspro
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Daily database backup (03:30, keeps 14 days)"
cat > /etc/cron.d/bankexamspro-backup <<CRON
30 3 * * * root mkdir -p /var/backups/bankexamspro && tar -czf /var/backups/bankexamspro/data-\$(date +\%F).tgz -C $APP_DIR/server data && find /var/backups/bankexamspro -mtime +14 -delete
CRON

echo
echo "Done. The site is live on http://$(curl -s ifconfig.me || echo '<this-VM-ip>')/"
echo "OTP codes print to:  journalctl -u bankexamspro -f"
echo "HTTPS (if you passed a domain):  apt install certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN"
