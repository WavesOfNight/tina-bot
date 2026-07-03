#!/usr/bin/env bash
set -euo pipefail

# Tina [BOT] - first-time VPS setup for Ubuntu (run as root: sudo bash setup.sh)
# Installs Node.js, Nginx, Certbot, clones the repo, builds everything,
# and wires up systemd services + HTTPS for liratsu.reads-records.com.

DOMAIN="liratsu.reads-records.com"
APP_DIR="/opt/tina-bot"
APP_USER="tina"
REPO_URL="${REPO_URL:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-tenebolloss@gmail.com}"

if [ -z "$REPO_URL" ]; then
  echo "Usage: REPO_URL=git@github.com:you/tina-bot.git bash setup.sh"
  echo "(or REPO_URL=https://github.com/you/tina-bot.git for HTTPS clone)"
  exit 1
fi

echo "==> Installing system packages"
apt-get update -y
apt-get install -y curl git nginx ffmpeg

if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js 22.x"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "==> Installing Certbot"
  apt-get install -y certbot python3-certbot-nginx
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
  echo "==> Creating system user '$APP_USER'"
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
fi

echo "==> Cloning / updating repository into $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  runuser -u "$APP_USER" -- git -C "$APP_DIR" pull
else
  mkdir -p "$APP_DIR"
  chown "$APP_USER":"$APP_USER" "$APP_DIR"
  runuser -u "$APP_USER" -- git clone "$REPO_URL" "$APP_DIR"
fi

DB_PATH="$APP_DIR/packages/database/prisma/dev.db"

if [ ! -f "$APP_DIR/packages/database/.env" ]; then
  echo "==> Writing packages/database/.env"
  cat > "$APP_DIR/packages/database/.env" <<EOF
DATABASE_URL=file:$DB_PATH
EOF
fi

if [ ! -f "$APP_DIR/apps/bot/.env" ]; then
  echo "==> Writing apps/bot/.env (generating a fresh TOKEN_ENCRYPTION_KEY)"
  TOKEN_KEY=$(openssl rand -hex 32)
  cat > "$APP_DIR/apps/bot/.env" <<EOF
DATABASE_URL=file:$DB_PATH
TOKEN_ENCRYPTION_KEY=$TOKEN_KEY
DISCORD_DEV_GUILD_ID=
EOF
else
  TOKEN_KEY=$(grep '^TOKEN_ENCRYPTION_KEY=' "$APP_DIR/apps/bot/.env" | cut -d= -f2-)
fi

if [ ! -f "$APP_DIR/apps/web/.env.local" ]; then
  echo "==> Writing apps/web/.env.local (reusing the same TOKEN_ENCRYPTION_KEY)"
  AUTH_SECRET=$(openssl rand -base64 32)
  cat > "$APP_DIR/apps/web/.env.local" <<EOF
DATABASE_URL=file:$DB_PATH
TOKEN_ENCRYPTION_KEY=$TOKEN_KEY
NEXTAUTH_URL=https://$DOMAIN
NEXTAUTH_SECRET=$AUTH_SECRET
EOF
fi

if [ ! -f "$APP_DIR/apps/twitch-bot/.env" ]; then
  echo "==> Writing apps/twitch-bot/.env (reusing the same TOKEN_ENCRYPTION_KEY)"
  cat > "$APP_DIR/apps/twitch-bot/.env" <<EOF
DATABASE_URL=file:$DB_PATH
TOKEN_ENCRYPTION_KEY=$TOKEN_KEY
EOF
fi

chown "$APP_USER":"$APP_USER" "$APP_DIR/packages/database/.env" "$APP_DIR/apps/bot/.env" "$APP_DIR/apps/web/.env.local" "$APP_DIR/apps/twitch-bot/.env"
chmod 600 "$APP_DIR/packages/database/.env" "$APP_DIR/apps/bot/.env" "$APP_DIR/apps/web/.env.local" "$APP_DIR/apps/twitch-bot/.env"

echo "==> Installing dependencies"
(cd "$APP_DIR" && runuser -u "$APP_USER" -- npm install)

echo "==> Generating Prisma client + compiling shared database package"
(cd "$APP_DIR" && runuser -u "$APP_USER" -- npm run db:build)

echo "==> Creating SQLite database (if not already present)"
(cd "$APP_DIR" && runuser -u "$APP_USER" -- npm run db:push)

echo "==> Building the bot"
(cd "$APP_DIR" && runuser -u "$APP_USER" -- npm run build --workspace=@tina/bot)

echo "==> Building the web dashboard"
(cd "$APP_DIR" && runuser -u "$APP_USER" -- npm run build --workspace=@tina/web)

echo "==> Building the Twitch bot"
(cd "$APP_DIR" && runuser -u "$APP_USER" -- npm run build --workspace=@tina/twitch-bot)

echo "==> Configuring Nginx"
cp "$APP_DIR/deploy/nginx/$DOMAIN.conf" "/etc/nginx/sites-available/$DOMAIN.conf"
ln -sf "/etc/nginx/sites-available/$DOMAIN.conf" "/etc/nginx/sites-enabled/$DOMAIN.conf"
nginx -t
systemctl reload nginx

echo "==> Installing systemd services"
cp "$APP_DIR/deploy/systemd/tina-bot.service" /etc/systemd/system/tina-bot.service
cp "$APP_DIR/deploy/systemd/tina-web.service" /etc/systemd/system/tina-web.service
cp "$APP_DIR/deploy/systemd/tina-twitch.service" /etc/systemd/system/tina-twitch.service
systemctl daemon-reload
systemctl enable --now tina-bot tina-web tina-twitch

echo "==> Requesting HTTPS certificate"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect

echo ""
echo "Done. Visit https://$DOMAIN to finish setup (create your admin account,"
echo "then paste your bot token in Parametres, and your Twitch bot account in Bot Twitch)."
echo "Check status with: systemctl status tina-bot tina-web tina-twitch"
