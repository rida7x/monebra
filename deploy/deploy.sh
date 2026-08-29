#!/usr/bin/env bash
#
# نشر تحديث على الخادم.
#
#   cd /var/www/monebra && ./deploy/deploy.sh
#
# يفترض أن الإعداد الأول تمّ (PostgreSQL، .env، خدمة systemd، Nginx).
# للإعداد الأول انظر deploy/README.md.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

say() { printf '\n\033[1;33m── %s\033[0m\n' "$1"; }

# ── فحوص قبل أي عمل ──
[ -f .env ] || { echo "✗ لا يوجد .env — انسخ deploy/env.production.example"; exit 1; }

# shellcheck disable=SC1091
DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' || true)"
[ -n "$DATABASE_URL" ] || { echo "✗ DATABASE_URL غير معرّف في .env"; exit 1; }

# ⚠️ حارس: النشر على SQLite يعني قاعدة بيانات ملفّية بلا نسخ احتياطي ولا
# تحمّل لكتابات متزامنة. أُوقف النشر بدل أن يكتشفه التاجر عند أول عطل.
case "$DATABASE_URL" in
  postgres://*|postgresql://*) : ;;
  *)
    echo "✗ DATABASE_URL ليس PostgreSQL: ${DATABASE_URL:0:20}…"
    echo "  الإنتاج يحتاج PostgreSQL. انظر deploy/README.md"
    exit 1
    ;;
esac

say "سحب آخر نسخة"
if [ -d .git ]; then
  git pull --ff-only
else
  echo "  (لا مستودع git — تخطّي)"
fi

say "تثبيت الحزم"
npm ci

say "ترحيل قاعدة البيانات"
# `migrate deploy` يطبّق الترحيلات الموجودة فقط ولا ينشئ جديدًا ولا يمسح
# بيانات — عكس `migrate dev` الذي لا يجوز تشغيله على الإنتاج أبدًا.
npx prisma migrate deploy

say "البناء"
npm run build

say "إعادة تشغيل الخدمة"
sudo systemctl restart monebra

say "التحقّق"
sleep 4
if curl -fsS -o /dev/null http://127.0.0.1:3000/; then
  echo "✓ المتجر يستجيب."
  echo "  السجل الحيّ: sudo journalctl -u monebra -f"
else
  echo "✗ المتجر لا يستجيب. اقرأ السجل:"
  echo "  sudo journalctl -u monebra -n 50 --no-pager"
  exit 1
fi

echo
echo "تم النشر من: $ROOT"
