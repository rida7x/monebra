# النشر على خادم خاص (VPS)

ملفات هذا المجلد جاهزة للنسخ إلى الخادم. رتّبها بالترتيب أدناه مرة واحدة،
ثم صار كل تحديث لاحق أمرًا واحدًا: `./deploy/deploy.sh`.

| الملف | إلى أين |
| --- | --- |
| `nginx.conf` | `/etc/nginx/sites-available/monebra` |
| `monebra.service` | `/etc/systemd/system/monebra.service` |
| `env.production.example` | `.env` داخل مجلد المشروع |
| `deploy.sh` | يبقى مكانه — يُشغَّل من جذر المشروع |

**ما لا يقدر عليه هذا الدليل:** شراء الخادم والنطاق، وتوجيه النطاق إلى
عنوان الخادم من لوحة مزوّد النطاق. افعلهما أولًا.

---

## ١· الخادم

أوبنتو 22.04 أو أحدث، وذاكرة **٢ جيجابايت على الأقل** — البناء (`next build`)
يستهلك أكثر من جيجابايت، وعلى خادم بجيجابايت واحد يُقتل بلا رسالة مفهومة.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx postgresql

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

مستخدم مخصّص للخدمة — لا تشغّل المتجر بصلاحيات الجذر:

```bash
sudo adduser --system --group --home /var/www/monebra monebra
```

---

## ٢· قاعدة البيانات

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE monebra;
CREATE USER monebra WITH ENCRYPTED PASSWORD 'ضع_كلمة_مرور_قوية';
GRANT ALL PRIVILEGES ON DATABASE monebra TO monebra;
ALTER DATABASE monebra OWNER TO monebra;
SQL
```

---

## ٣· الكود

```bash
sudo mkdir -p /var/www/monebra
sudo chown monebra:monebra /var/www/monebra

# انسخ المشروع (git clone أو scp من جهازك)
sudo -u monebra git clone <رابط-المستودع> /var/www/monebra
cd /var/www/monebra
```

### غيّر مزوّد قاعدة البيانات

سطر واحد في `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"   // كان "sqlite"
  url      = env("DATABASE_URL")
}
```

> **لماذا يدويًا؟** Prisma يقرأ `provider` وقت توليد الأنواع وبناء
> الترحيلات، فلا يقبل قيمة من البيئة. أما **محوّل** الاتصال فيُختار
> تلقائيًا من `DATABASE_URL` (انظر `src/lib/db-adapter.ts`) — فلا تعديل
> في الكود.

### الترحيلات

ترحيلات SQLite الموجودة لا تعمل على PostgreSQL (أنواع مختلفة). ابنِ
واحدة نظيفة:

```bash
rm -rf prisma/migrations
npx prisma migrate dev --name init    # على جهازك أو هنا قبل التشغيل
```

### البيئة

```bash
cp deploy/env.production.example .env
nano .env                 # عبّئ القيم — اقرأ التعليقات داخله
chmod 600 .env
```

`AUTH_SECRET` ولّده هكذا:

```bash
openssl rand -base64 32
```

### البناء وحساب المدير

```bash
npm ci
npm run build
npm run db:seed -- --no-demo    # المدن والتصنيفات بلا منتجات تجريبية
npm run seed:admin              # تفاعلي — يسألك عن البريد وكلمة المرور
```

---

## ٤· الخدمة

```bash
sudo cp deploy/monebra.service /etc/systemd/system/monebra.service
sudo systemctl daemon-reload
sudo systemctl enable --now monebra
sudo systemctl status monebra
```

---

## ٥· Nginx و HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/monebra
sudo nano /etc/nginx/sites-available/monebra     # ضع نطاقك مكان monebra.ly
sudo ln -s /etc/nginx/sites-available/monebra /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

ثم الشهادة — certbot يعيد كتابة الملف ليضيف TLS وتحويل 80 ← 443:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d monebra.ly -d www.monebra.ly
```

الجدار الناري:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

> **لا تفتح المنفذ 3000 في الجدار الناري.** التطبيق يستمع على
> `127.0.0.1` فقط، والوصول من الخارج يمرّ عبر Nginx وحده — وهو ما يضبط
> ترويسة عنوان الزائر التي يعتمد عليها تحديد المعدّل.

---

## ٦· بعد النشر — تحقّق

```bash
curl -I https://monebra.ly                    # 200
curl -s https://monebra.ly/sitemap.xml | head # نطاقك لا localhost
curl -I https://monebra.ly/admin              # 307 إلى صفحة الدخول
```

وفي المتصفح: سجّل الدخول للوحة، وارفع صورة منتج (يتحقق من
`client_max_body_size`)، وأنشئ طلب تجربة ثم احذفه.

---

## ٧· النسخ الاحتياطي

قاعدة البيانات والصور معًا — الصور ليست في قاعدة البيانات:

```bash
sudo crontab -e
```

```cron
0 3 * * * sudo -u postgres pg_dump monebra | gzip > /var/backups/monebra-$(date +\%F).sql.gz
0 4 * * * tar czf /var/backups/uploads-$(date +\%F).tar.gz -C /var/www/monebra/public uploads
0 5 * * * find /var/backups -name 'monebra-*' -o -name 'uploads-*' -mtime +30 -delete
```

> نسخة احتياطية لم تُجرَّب استعادتها ليست نسخة احتياطية. جرّب الاستعادة
> على قاعدة اختبار مرة واحدة على الأقل.

---

## التحديثات اللاحقة

```bash
cd /var/www/monebra && ./deploy/deploy.sh
```

يسحب الكود، ويثبّت الحزم، ويطبّق الترحيلات، ويبني، ويعيد التشغيل، ثم
يتحقق أن المتجر يستجيب. ويرفض العمل إن كانت `DATABASE_URL` ليست
PostgreSQL.
