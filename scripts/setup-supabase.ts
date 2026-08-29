import 'dotenv/config';
import { execSync } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { stdout } from 'node:process';
import { Client } from 'pg';

import { ask, askSecret } from './lib/prompt.js';

/**
 * ينقل المتجر من SQLite المحلية إلى Supabase — بأمر واحد.
 *
 *   npm run setup:supabase
 *
 * يسأل عن معرّف المشروع وكلمة مرور القاعدة فقط، ثم يتولّى الباقي: يعثر على
 * الخادم الصحيح، ويكتب `.env`، ويبدّل المزوّد، ويبني الترحيل، وينقل
 * البيانات، ويتحقق.
 *
 * ── لماذا يبحث عن الخادم بدل سؤاله ────────────────────────────────
 * رابط Supabase يحوي منطقة الخادم (`aws-0-eu-central-1` مثلًا)، وهي أكثر ما
 * يُخطئ فيه غير المبرمج لأنها لا تُعرف إلا من لوحة التحكم. الأسهل أن نجرّب
 * المناطق المعروفة بكلمة المرور: التي تقبل الاتصال هي الصحيحة.
 *
 * ⚠️ المنفذ 5432 على مضيف `pooler` = Session pooler. لا نستعمل 6543
 * (Transaction pooler) لأن إنشاء الطلب معاملة تفاعلية تنكسر معه — ومعها
 * حارس البيع الزائد.
 */

const REGIONS = [
  'eu-west-1', 'eu-central-1', 'eu-central-2', 'eu-west-2', 'eu-west-3',
  'eu-north-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
  'ap-northeast-2', 'ca-central-1', 'sa-east-1',
];

const PREFIXES = ['aws-0', 'aws-1'];
const PORT = 5432;

/**
 * سجلّ نصّي لكل ما يجري.
 *
 * ⚠️ نافذة الأوامر تعرض العربية معكوسة وتبتلع السطور الطويلة، فقراءة خطأ
 * حقيقي منها شبه مستحيلة. الملف يحتفظ بالنص كما هو — ومنه وحده يُعرف سبب
 * الفشل بدل التخمين. تُنزع منه ألوان الطرفية وكلمة المرور.
 */
const LOG = 'setup-log.txt';

/**
 * نسخة الجداول التي ليست من المتجر، تُكتب قبل حذفها من Supabase.
 *
 * على سطح المكتب لا داخل مجلد المشروع: صاحب المتجر يفتح سطح مكتبه ولا يفتح
 * مجلدات الكود، وملف إنقاذ لا يجده صاحبه كأنه غير موجود.
 */
const STRANGERS_BACKUP = '../جداول-محفوظة-من-سوبابيس.json';
const logLines: string[] = [`سجل التشغيل — ${new Date().toISOString()}`];
let secretToMask = '';

function record(text: string) {
  let clean = text.replace(/\x1b\[[0-9;]*m/g, '');
  if (secretToMask) clean = clean.split(secretToMask).join('«كلمة المرور»');
  logLines.push(clean);
}

async function flushLog() {
  await writeFile(LOG, logLines.join('\n'), 'utf8').catch(() => undefined);
}

function say(message: string) {
  console.log(message);
  record(message);
}

function step(n: number, title: string) {
  const line = `\n[${n}/6] ${title}`;
  console.log(`\n\x1b[1;33m[${n}/6] ${title}\x1b[0m`);
  record(line);
}

/**
 * نتيجة محاولة الاتصال بمضيف واحد.
 *
 * ⚠️ التمييز بين `wrong-password` و`not-here` هو جوهر هذا السكربت: كلاهما
 * «فشل اتصال»، لكن معناهما متعاكس. المجمّع يردّ:
 *   28P01 → عرف مشروعك ورفض كلمة المرور  ← **هذا هو خادمك**
 *   XX000 (ENOTFOUND tenant) → مشروعك ليس في هذه المنطقة
 * خلطهما يُنتج رسالة «تعذّر الاتصال بأي منطقة» بينما الخادم صحيح وكلمة
 * المرور وحدها خاطئة — فيبحث المستخدم في المكان الخطأ.
 */
type Probe = 'ok' | 'wrong-password' | 'not-here';

async function probe(
  host: string,
  ref: string,
  password: string,
): Promise<Probe> {
  const client = new Client({
    host,
    port: PORT,
    user: `postgres.${ref}`,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    await client.connect();
    await client.query('select 1');
    return 'ok';
  } catch (error) {
    const code = (error as { code?: string }).code;
    return code === '28P01' ? 'wrong-password' : 'not-here';
  } finally {
    await client.end().catch(() => undefined);
  }
}

type Found = { host: string; status: Exclude<Probe, 'not-here'> } | null;

async function findHost(ref: string, password: string): Promise<Found> {
  const hosts = PREFIXES.flatMap((prefix) =>
    REGIONS.map((region) => `${prefix}-${region}.pooler.supabase.com`),
  );

  // بدفعات: عشرات الاتصالات المتزامنة تُبطئ أكثر مما تُسرّع
  const BATCH = 6;

  for (let i = 0; i < hosts.length; i += BATCH) {
    stdout.write('.');

    const results = await Promise.all(
      hosts.slice(i, i + BATCH).map(async (host) => ({
        host,
        status: await probe(host, ref, password),
      })),
    );

    const hit = results.find((r) => r.status !== 'not-here');
    if (hit) {
      console.log();
      return { host: hit.host, status: hit.status as Exclude<Probe, 'not-here'> };
    }
  }

  console.log();
  return null;
}

/** يُملأ بعد أول تعديل على ملفات المشروع، ليُستدعى عند أي فشل بعده */
let rollback: (() => Promise<void>) | null = null;

async function main() {
  say('\n\x1b[1m  نقل متجر مونيبرا إلى Supabase\x1b[0m');
  say('  ─────────────────────────────────\n');

  // ── ١ · المعطيات ──
  step(1, 'بياناتك');

  const envText = await readFile('.env', 'utf8');

  // المعرّف يُقرأ من ثلاثة مواضع محتملة: المتغيّر المخصّص، ثم رابط المشروع
  // إن كان المستخدم قد لصقه، ثم رابط قاعدة جاهز. هكذا لا يُسأل عنه مرتين
  // مهما تبدّلت `DATABASE_URL` بين التشغيلات.
  const guess =
    envText.match(/^SUPABASE_PROJECT_REF="?([a-z0-9]{16,})"?/m)?.[1] ??
    envText.match(/https:\/\/([a-z0-9]{16,})\.supabase\.co/)?.[1] ??
    envText.match(/postgres\.([a-z0-9]{16,}):/)?.[1] ??
    '';

  const ref = await ask(`  معرّف المشروع${guess ? ` [${guess}]` : ''}: `, guess);

  if (!/^[a-z0-9]{16,}$/.test(ref)) {
    throw new Error(
      'معرّف المشروع غير صالح.\n' +
        '  هو الجزء الطويل في رابط لوحة Supabase:\n' +
        '  supabase.com/dashboard/project/XXXXXXXXXXXX  ← هذا',
    );
  }

  // ── ٢ · الخادم وكلمة المرور ──
  // ثلاث محاولات: كلمة مرور خاطئة لا يجوز أن تعني إعادة كل شيء من أوله،
  // ولا إعادة مسح المناطق — بعد أول نجاح في تحديد الخادم نعرفه.
  step(2, 'البحث عن خادم مشروعك');

  let host = '';
  let password = '';

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    password = await askSecret('  كلمة مرور قاعدة Supabase: ');
    if (!password) throw new Error('كلمة المرور مطلوبة.');

    // من الآن تُحجب في السجل — رسائل Prisma تطبع رابط الاتصال كاملًا
    secretToMask = password;

    if (host) {
      // الخادم معروف — نتحقق من كلمة المرور وحدها
      const status = await probe(host, ref, password);
      if (status === 'ok') break;
    } else {
      say('  نبحث عن خادم مشروعك (قد يستغرق دقيقة)...');
      const found = await findHost(ref, password);

      if (!found) {
        throw new Error(
          'لم نجد مشروعك في أي منطقة.\n' +
            `  تأكد أن معرّف المشروع صحيح (${ref}) وأن المشروع ليس متوقفًا\n` +
            '  في لوحة Supabase.',
        );
      }

      host = found.host;
      say(`  ✓ خادمك: ${host}`);

      if (found.status === 'ok') break;
    }

    if (attempt === 3) {
      throw new Error(
        'كلمة المرور غير صحيحة بعد ثلاث محاولات.\n' +
          '  هي كلمة مرور **قاعدة البيانات** لا كلمة دخولك إلى Supabase.\n' +
          '  إن نسيتها: لوحة Supabase ← Project Settings ← Database ←\n' +
          '  Reset database password، ثم أعد تشغيل هذا الملف.',
      );
    }

    say(`  ✗ كلمة المرور غير صحيحة — حاول مرة أخرى (${attempt}/3)\n`);
  }

  const url =
    `postgresql://postgres.${ref}:${encodeURIComponent(password)}` +
    `@${host}:${PORT}/postgres?connection_limit=1`;

  // ── ٣ · الإعدادات ──
  step(3, 'كتابة .env وتبديل المزوّد');

  // من هنا فصاعدًا نعدّل ملفات المشروع. أي فشل لاحق يجب أن يرجعها إلى
  // حالتها الأولى، وإلا بقي المتجر بمزوّد PostgreSQL بلا جداول — فلا هو
  // يعمل على Supabase ولا على SQLite المحلية.
  const schemaPath = 'prisma/schema.prisma';
  const schema = await readFile(schemaPath, 'utf8');

  rollback = async () => {
    await writeFile('.env', envText, 'utf8');
    await writeFile(schemaPath, schema, 'utf8');
    say('  ↩ أُرجعت الإعدادات — متجرك المحلي يعمل كما كان.');
    say('    (أعد بناء الترحيلات عند الحاجة: npx prisma migrate dev)');
  };

  let updated = envText.includes('DATABASE_URL=')
    ? envText.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${url}"`)
    : `DATABASE_URL="${url}"\n${envText}`;

  // نثبّت المعرّف كي لا يُسأل عنه في أي تشغيل لاحق
  updated = updated.includes('SUPABASE_PROJECT_REF=')
    ? updated.replace(
        /^SUPABASE_PROJECT_REF=.*$/m,
        `SUPABASE_PROJECT_REF="${ref}"`,
      )
    : `SUPABASE_PROJECT_REF="${ref}"\n${updated}`;

  await writeFile('.env', updated, 'utf8');
  say('  ✓ .env');

  await writeFile(
    schemaPath,
    schema.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"'),
    'utf8',
  );
  say('  ✓ provider = postgresql');

  // ── ٤ · المخطّط ──
  step(4, 'بناء الجداول على Supabase');

  /**
   * فحص ما في القاعدة قبل الكتابة.
   *
   * ⚠️ `prisma db push` يجعل القاعدة **مطابقة** للمخطّط، فيحذف أي جدول
   * زائد. على قاعدة فيها جداول سابقة يسأل سؤالًا تفاعليًا — وهو سؤال لا
   * يصل إلى المستخدم هنا فتُلغى العملية بلا سبب ظاهر (هذا ما حدث فعلًا:
   * جدول `backups` بصفّ واحد أوقف كل شيء).
   *
   * فنسأل نحن، بالعربية، وبعد أن نعرض ما سيُحذف وكم صفًا فيه.
   */
  const expected = new Set(
    [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]!),
  );

  const inspector = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  const strangers: Array<{ table: string; rows: number }> = [];

  await inspector.connect();
  try {
    const { rows } = await inspector.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );

    for (const { table_name: table } of rows) {
      if (expected.has(table) || table === '_prisma_migrations') continue;

      // اسم الجدول من القاعدة نفسها لا من مدخل مستخدم، لكن نقتبسه احتياطًا
      const count = await inspector.query<{ n: number }>(
        `select count(*)::int n from "${table.replace(/"/g, '""')}"`,
      );

      strangers.push({ table, rows: count.rows[0]?.n ?? 0 });
    }
  } finally {
    await inspector.end();
  }

  if (strangers.length > 0) {
    /**
     * ⚠️ السؤال وحده كان يوقف الإعداد. «أحذف جداول لا أعرفها؟» سؤال لا يملك
     * غير المبرمج جوابًا آمنًا له، فيردّ «لا» ويقف كل شيء — وهذا ما حدث فعلًا
     * مع جدول `backups`. فننسخ محتواها إلى ملف على جهازه **قبل** أن نسأل:
     * عندها يصير الجواب بلا خسارة ممكنة، والسؤال إخبارًا لا امتحانًا.
     */
    say('');
    say('  ⚠ في قاعدتك جداول ليست من المتجر:');
    for (const s of strangers) {
      say(`     • ${s.table} — ${s.rows} صفًا`);
    }

    say('');
    say('  ننسخ محتواها إلى ملف على جهازك أولًا...');

    const keeper = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });

    const saved: Record<string, unknown[]> = {};

    await keeper.connect();
    try {
      for (const { table } of strangers) {
        const { rows } = await keeper.query(
          `select * from "${table.replace(/"/g, '""')}"`,
        );
        saved[table] = rows;
      }
    } finally {
      await keeper.end();
    }

    // ⚠️ BigInt لا يُسلسَل إلى JSON وأعمدة bigint شائعة في جداول التجارب،
    // فبلا هذا المحوّل تنكسر النسخة الاحتياطية على الجدول الذي جئنا ننقذه.
    const dump = JSON.stringify(
      { savedAt: new Date().toISOString(), project: ref, tables: saved },
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    );

    await writeFile(STRANGERS_BACKUP, dump, 'utf8');
    say(`  ✓ نسخة محفوظة: ${STRANGERS_BACKUP}`);

    say('');
    say('  بناء جداول المتجر يحذفها من Supabase — لكن النسخة أعلاه تبقى');
    say('  عندك. إن تبيّن لاحقًا أنك تحتاجها، الملف فيه كل صفوفها.');
    say('');

    const answer = await ask('  نكمل؟ [نعم]: ', 'نعم');

    if (answer !== 'نعم' && answer.toLowerCase() !== 'yes') {
      throw new Error(
        'أُلغي بناءً على طلبك — لم يُحذف شيء.\n' +
          `  نسخة الجداول محفوظة على أي حال: ${STRANGERS_BACKUP}`,
      );
    }
  }

  /**
   * ينفّذ أمرًا ويحتفظ بمخرجاته في السجلّ.
   *
   * ⚠️ `stdio: 'inherit'` كان يمرّر مخرجات Prisma إلى الشاشة فقط، فيضيع نص
   * الخطأ الحقيقي بمجرد إغلاق النافذة. نلتقطها هنا ونطبعها **و**نسجّلها.
   */
  const run = (cmd: string) => {
    record(`\n$ ${cmd}`);

    try {
      const out = execSync(cmd, {
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { ...process.env, DATABASE_URL: url },
      });

      if (out) {
        stdout.write(out);
        record(out);
      }
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string; message?: string };
      const detail = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n');
      stdout.write(detail + '\n');
      record(detail);
      throw new Error(`فشل الأمر: ${cmd}`);
    }
  };

  /**
   * ⚠️ `db push` لا `migrate dev`، لسببين:
   *
   *  1. `migrate dev` ينشئ **قاعدة ظل** مؤقتة ليحسب الفروق، وحساب Supabase
   *     الافتراضي لا يملك صلاحية إنشاء قواعد — فيفشل بخطأ صلاحيات غامض.
   *  2. `migrate dev` يشغّل ملف البذرة بعد النجاح، فيزرع منتجات تجريبية
   *     قبل أن ننقل منتجات التاجر الحقيقية — ثم يتضاربان.
   *
   * `db push` يبني الجداول من المخطّط مباشرة: بلا قاعدة ظل وبلا بذر.
   */
  // `--accept-data-loss` بعد موافقة صريحة أعلاه لا قبلها. وبدونه يطرح
  // Prisma سؤالًا تفاعليًا لا يصل إلى المستخدم، فتُلغى العملية صامتة.
  run('npx prisma db push --accept-data-loss');
  run('npx prisma generate');

  // ── ٥ · البيانات ──
  step(5, 'نقل بياناتك');
  run('npx tsx scripts/db-transfer.ts import');

  // ── ٦ · التحقق ──
  step(6, 'التحقق');

  const check = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await check.connect();

  try {
    const checks: Array<[string, string]> = [
      ['منتجات', 'select count(*)::int n from products'],
      ['مدن', 'select count(*)::int n from cities'],
      ['إعدادات', 'select count(*)::int n from settings'],
      ['حسابات إدارة', 'select count(*)::int n from admin_users'],
    ];

    for (const [label, sql] of checks) {
      const { rows } = await check.query<{ n: number }>(sql);
      say(`  ${label}: ${rows[0]!.n}`);
    }
  } finally {
    await check.end();
  }

  // ترحيلات SQLite لا تعمل على PostgreSQL (أنواع مختلفة). تُحذف **هنا**
  // لا قبل البناء: الحذف المبكر كان يفقدها عند أي فشل لاحق، فيبقى المشروع
  // بلا ترحيلات ولا قاعدة جديدة.
  await rm('prisma/migrations', { recursive: true, force: true });

  say('\n\x1b[1;32m  ✓ تمّ. المتجر الآن على Supabase.\x1b[0m');
  say('  شغّل: npm run build && npm start\n');
}

main()
  .then(flushLog)
  .catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n\x1b[1;31m  ✗ ${message}\x1b[0m\n`);
    record(`\n✗ ${message}`);

    if (rollback) {
      await rollback().catch(() => {
        console.error('  ⚠ تعذّر الإرجاع. راجع .env و prisma/schema.prisma.');
      });
    }

    await flushLog();

    console.error(`  السجل الكامل في: ${LOG}`);
    console.error('  أرسله كما هو ليُعرف السبب.\n');

    process.exit(1);
  });
