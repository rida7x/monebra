import 'dotenv/config';
import { execSync } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { stdin, stdout } from 'node:process';
import { Client } from 'pg';

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
  'eu-central-1', 'eu-central-2', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-north-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
  'ap-northeast-2', 'ca-central-1', 'sa-east-1',
];

const PREFIXES = ['aws-0', 'aws-1'];
const PORT = 5432;

/** مفاتيح تحكّم — بالرمز لا بالحرف، كي لا تفسد عند نسخ الملف أو تحريره */
const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const BACKSPACE = String.fromCharCode(127);

function say(message: string) {
  console.log(message);
}

function step(n: number, title: string) {
  console.log(`\n\x1b[1;33m[${n}/6] ${title}\x1b[0m`);
}

/**
 * قارئ واحد لكل الأسئلة — بإظهار أو بإخفاء.
 *
 * ⚠️ لماذا لا نستخدم `readline`: إنشاء واجهتين متتاليتين على نفس `stdin`
 * يجعل الأولى تبتلع سطر الثانية، فتُقرأ كلمة المرور فارغة أو يتجمّد الطلب.
 * مصدر قراءة واحد يزيل هذه الفئة من الأخطاء كلها.
 *
 * وخارج الطرفية التفاعلية نقرأ من التدفّق مباشرة بدل التعليق في انتظار وضع
 * خام لا وجود له.
 */
function askLine(prompt: string, mask = false): Promise<string> {
  stdout.write(prompt);

  if (!stdin.isTTY) {
    return new Promise((resolve) => {
      let buffer = '';
      stdin.setEncoding('utf8');

      const onData = (chunk: string) => {
        buffer += chunk;
        const end = buffer.indexOf('\n');
        if (end < 0) return;

        stdin.removeListener('data', onData);
        stdin.pause();
        // ما بعد السطر يعود إلى التدفّق ليقرأه السؤال التالي
        stdin.unshift(buffer.slice(end + 1));
        resolve(buffer.slice(0, end).replace(/\r$/, '').trim());
      };

      stdin.on('data', onData);
      stdin.resume();
    });
  }

  return new Promise((resolve, reject) => {
    let value = '';
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.resume();

    const finish = (action: () => void) => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      action();
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\n' || char === '\r' || char === CTRL_D) {
          return finish(() => resolve(value.trim()));
        }

        if (char === CTRL_C) {
          return finish(() => reject(new Error('أُلغي.')));
        }

        if (char === BACKSPACE || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (!mask) stdout.write('\b \b');
          }
          continue;
        }

        // تجاهل مفاتيح التحكم والأسهم
        if (char >= ' ') {
          value += char;
          if (!mask) stdout.write(char);
        }
      }
    };

    stdin.on('data', onData);
  });
}

async function ask(prompt: string, fallback = ''): Promise<string> {
  return (await askLine(prompt)) || fallback;
}

const askSecret = (prompt: string) => askLine(prompt, true);

/** يحاول الاتصال بمضيف واحد. يعيد true عند النجاح. */
async function probe(host: string, ref: string, password: string) {
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
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function findHost(ref: string, password: string): Promise<string | null> {
  const hosts = PREFIXES.flatMap((prefix) =>
    REGIONS.map((region) => `${prefix}-${region}.pooler.supabase.com`),
  );

  // بدفعات: عشرات الاتصالات المتزامنة تُبطئ أكثر مما تُسرّع
  const BATCH = 6;

  for (let i = 0; i < hosts.length; i += BATCH) {
    stdout.write('.');

    const results = await Promise.all(
      hosts
        .slice(i, i + BATCH)
        .map(async (host) => ((await probe(host, ref, password)) ? host : null)),
    );

    const found = results.find(Boolean);
    if (found) {
      console.log();
      return found;
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
  const guess = envText.match(/https:\/\/([a-z0-9]{20})\.supabase\.co/)?.[1] ?? '';

  const ref = await ask(`  معرّف المشروع${guess ? ` [${guess}]` : ''}: `, guess);

  if (!/^[a-z0-9]{16,}$/.test(ref)) {
    throw new Error('معرّف المشروع غير صالح. تجده في رابط لوحة Supabase.');
  }

  const password = await askSecret('  كلمة مرور القاعدة (لا تظهر): ');
  if (!password) throw new Error('كلمة المرور مطلوبة.');

  // ── ٢ · الخادم ──
  step(2, 'البحث عن خادم مشروعك');
  say('  (نجرّب المناطق — قد يستغرق دقيقة)');

  const host = await findHost(ref, password);

  if (!host) {
    throw new Error(
      'تعذّر الاتصال بأي منطقة.\n' +
        '  تحقق من كلمة المرور ومن معرّف المشروع، وأن المشروع ليس متوقفًا.',
    );
  }

  say(`  ✓ ${host}`);

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

  const updated = envText.includes('DATABASE_URL=')
    ? envText.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${url}"`)
    : `DATABASE_URL="${url}"\n${envText}`;

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
  say('  (ترحيلات SQLite لا تعمل على PostgreSQL — نبني واحدًا نظيفًا)');

  await rm('prisma/migrations', { recursive: true, force: true });

  const run = (cmd: string) =>
    execSync(cmd, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url },
    });

  run('npx prisma migrate dev --name init --skip-seed');
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

  say('\n\x1b[1;32m  ✓ تمّ. المتجر الآن على Supabase.\x1b[0m');
  say('  شغّل: npm run build && npm start\n');
}

main().catch(async (error) => {
  console.error(
    `\n\x1b[1;31m  ✗ ${error instanceof Error ? error.message : error}\x1b[0m\n`,
  );

  if (rollback) {
    await rollback().catch(() => {
      console.error('  ⚠ تعذّر الإرجاع. راجع .env و prisma/schema.prisma.');
    });
  }

  process.exit(1);
});
