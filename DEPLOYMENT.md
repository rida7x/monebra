# دليل الإطلاق — Monebra Perfume

هذا الدليل يأخذك من نسخة التطوير الحالية إلى متجر يعمل على الإنترنت.

---

## قبل أي شيء: ما الذي يجب تغييره؟

المتجر جاهز تقنيًا، لكنه ما يزال يحمل **بيانات تجريبية**. القائمة التالية
ليست اختيارية:

| البند | أين تغيّره | لماذا |
| --- | --- | --- |
| حساب المدير | `npm run seed:admin` | لا يوجد حساب افتراضي في الكود |
| رسوم التوصيل | `/admin/cities` | القيم الحالية تجريبية (طرابلس ١٠، بنغازي ١٥، سبها ٢٠) وباقي المدن بصفر |
| رقم واتساب والهاتف | `/admin/settings` | فارغة الآن، وأزرار التواصل لا تظهر بدونها |
| روابط TikTok وInstagram | `/admin/settings` | فارغة الآن |
| الشعار | `/admin/settings` ثم `npm run icons -- <المسار>` | يظهر اسم المتجر بخط أنيق بدونه |
| نصوص السياسات | `/admin/content` | معلَّمة بشارة «نص افتراضي — عدّله قبل الإطلاق» |
| المنتجات التجريبية | `/admin/products` | ١٢ منتجًا تجريبيًا بأسماء وأسعار وهمية |

للبدء بقاعدة نظيفة بلا محتوى تجريبي:

```bash
npm run db:seed -- --no-demo
```

---

## الخطوة ١: PostgreSQL

قاعدة البيانات الحالية SQLite للتطوير. المخطّط مكتوب بأنواع متوافقة مع
PostgreSQL عمدًا — بلا `enum` وبلا حقول `Json` أصلية — فالانتقال ثلاث
خطوات لا أكثر.

### أ. أنشئ قاعدة بيانات

أي مزوّد يعمل. المجاني منها يكفي متجرًا في بدايته:
Neon أو Supabase أو Railway، أو PostgreSQL على خادمك الخاص.

احصل على `connection string` بهذا الشكل:

```
postgresql://user:password@host:5432/monebra?sslmode=require
```

### ب. غيّر المزوّد

في `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
}
```

في `src/lib/db.ts` استبدل المحوّل:

```bash
npm install @prisma/adapter-pg pg
npm uninstall @prisma/adapter-better-sqlite3
```

```ts
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: databaseUrl });
```

نفس التبديل في `prisma/seed.ts` و`scripts/*.ts`.

### ج. طبّق المخطّط

```bash
# احذف migrations الخاصة بـ SQLite وابنِ واحدة جديدة لـ PostgreSQL
rm -rf prisma/migrations
npx prisma migrate dev --name init
npm run db:seed -- --no-demo
npm run seed:admin
```

> **نقل بياناتك الحالية؟** إن كنت قد أدخلت منتجات حقيقية في SQLite، صدّرها
> أولًا بسكربت بسيط يقرأ من SQLite ويكتب عبر Prisma إلى PostgreSQL. لا
> تنسخ ملف `dev.db` — الصيغتان مختلفتان.

---

## الخطوة ٢: متغيّرات البيئة

```bash
DATABASE_URL="postgresql://..."
AUTH_SECRET="<ناتج: openssl rand -base64 48>"
NEXT_PUBLIC_SITE_URL="https://monebra.ly"
STORAGE_DRIVER="local"
```

⚠️ **`AUTH_SECRET` يجب أن يكون عشوائيًا وسريًا.** لا تستخدم القيمة
الموجودة في `.env` الحالي — فهي للتطوير ومكتوبة في المستودع.

⚠️ **`NEXT_PUBLIC_SITE_URL` يجب أن يكون نطاقك الحقيقي** — تعتمد عليه
خريطة الموقع و`robots.txt` والبيانات المنظّمة وروابط المشاركة.

---

## الخطوة ٣: أين تستضيف؟

### الخيار الأول — خادم خاص (VPS)

**الأنسب لهذا المتجر.** السبب: الصور تُحفظ على القرص في `public/uploads`،
وهو ما يعمل مباشرة على خادم دائم بلا خدمة تخزين إضافية.

```bash
# على الخادم
git clone <repo> && cd monebra-store
npm ci
npx prisma migrate deploy
npm run build
npm start        # أو عبر pm2 / systemd
```

ثم Nginx أمامه لإنهاء HTTPS:

```nginx
server {
  server_name monebra.ly;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  client_max_body_size 10M;   # لرفع صور المنتجات
}
```

⚠️ **`X-Forwarded-For` ضروري**: بدونه يرى التطبيق كل الزوار بعنوان واحد،
فيحظر تحديد المعدّل عملاء أبرياء.

احصل على شهادة HTTPS مجانية:

```bash
sudo certbot --nginx -d monebra.ly
```

### الخيار الثاني — Vercel

أسهل نشرًا وشبكة توزيع عالمية، **لكن قرصه مؤقت**: الصور المرفوعة تختفي
عند كل نشر. يلزمك تخزين سحابي.

طبقة التخزين مجرّدة في `src/lib/storage.ts` — استبدل جسم `saveImage`
و`removeImage` بمزوّد سحابي (Vercel Blob مثلًا) دون لمس أي مكان آخر
يستدعيها.

---

## الخطوة ٤: بعد النشر — تحقّق

```bash
# الصفحات الأساسية
curl -I https://monebra.ly/
curl -I https://monebra.ly/products

# السيو
curl https://monebra.ly/robots.txt
curl https://monebra.ly/sitemap.xml | head -20

# التطبيق التقدّمي
curl https://monebra.ly/manifest.webmanifest
```

قائمة يدوية:

- [ ] الكوكي الإداري يعمل (يتطلب HTTPS — `Secure` مفعّل في الإنتاج)
- [ ] رفع صورة منتج ينجح ويظهر بعد النشر التالي
- [ ] طلب تجريبي كامل ثم **ألغِه** ليعود المخزون
- [ ] الفاتورة تُطبع بشكل صحيح
- [ ] المتجر يفتح على هاتف حقيقي ويُضاف للشاشة الرئيسية

---

## الخطوة ٥: النسخ الاحتياطي

**افعل هذا قبل أول طلب حقيقي.** بيانات الطلبات لا تُعوَّض.

```bash
# يومي عبر cron
pg_dump "$DATABASE_URL" | gzip > backup-$(date +%F).sql.gz

# والصور
tar czf uploads-$(date +%F).tar.gz public/uploads
```

احتفظ بنسخة **خارج الخادم**. النسخة التي تعيش على نفس الجهاز لا تحميك من
فقدانه.

---

## الأمان في الإنتاج

ما هو مفعّل تلقائيًا:

| الحماية | التفاصيل |
| --- | --- |
| كلمات المرور | Argon2id بمعاملات OWASP |
| الجلسات | رمز عشوائي، تُخزَّن تجزئته فقط، تُبطَل فورًا عند الخروج |
| كوكي الجلسة | `HttpOnly` + `Secure` + `SameSite=Lax` |
| حظر التخمين | بالبريد وبالـIP + تجزئة وهمية تُساوي زمن الاستجابة |
| تحديد المعدّل | ٥ طلبات/٥ دقائق، ١٠ محاولات تتبّع، ١٠ محاولات دخول |
| الترويسات | CSP، HSTS، `X-Frame-Options: DENY`، `nosniff` |
| الأسعار | تُحسب على الخادم حصرًا — لا يُقرأ أي مبلغ من المتصفح |
| المخزون | خصم داخل معاملة بشرط `stock >= qty` — لا بيع زائد |
| الصلاحيات | تُفحص في كل صفحة وكل نقطة نهاية |
| رفع الملفات | `sharp` يرفض أي ملف ليس صورة حقيقية |

ما يبقى عليك:

- شهادة HTTPS صالحة ومتجدّدة
- `AUTH_SECRET` عشوائي وسري
- تحديث الاعتماديات دوريًا: `npm audit`
- مراجعة `/admin/logs` من حين لآخر
- حساب إداري منفصل لكل موظف — لا حساب مشترك

---

## استكشاف الأعطال

**لا أستطيع تسجيل الدخول إلى اللوحة**
كوكي الجلسة `Secure` في الإنتاج فلا يعمل على HTTP. تأكد أن الموقع يُقدَّم
عبر HTTPS.

**رفع الصور يفشل**
تأكد أن `public/uploads` قابل للكتابة، وأن `client_max_body_size` في Nginx
لا يقل عن 10M.

**كل الزوار يُحظرون بتحديد المعدّل**
الوكيل العكسي لا يمرّر `X-Forwarded-For`، فيبدو الجميع بعنوان واحد.

**منتج باسم عربي يعطي 404**
هذا خطأ عولج في `decodeSlug` داخل `src/lib/utils.ts`. إن عاد، فالمسار
الديناميكي الجديد لا يفكّ ترميز `params` — الروابط العربية تصل مُرمَّزة
بالنسبة المئوية.

**تعديل في اللوحة لا يظهر في المتجر**
الصفحات مخزّنة مؤقتًا. كل عملية حفظ تستدعي إبطالًا من `src/lib/cache.ts` —
تأكد أن المسار الجديد مشمول هناك.
