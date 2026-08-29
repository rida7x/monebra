import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stdout, platform } from 'node:process';

import { ask } from './lib/prompt.js';

/**
 * ينشر المتجر على Netlify — بأمر واحد.
 *
 *   npm run deploy
 *
 * ── لماذا سكربت بدل خطوات يدوية ───────────────────────────────────
 * النشر اليدوي سبع خطوات، وثلاث منها تفشل صامتة: قاعدة SQLite تُرفع فتضيع
 * كل الطلبات، و`STORAGE_DRIVER` غير مضبوط فتختفي صور المنتجات عند أول نشر
 * تالٍ، و`NEXT_PUBLIC_SITE_URL` يبقى localhost فتُفهرس جوجل عناوين لا وجود
 * لها. كلها تُنتج موقعًا «يعمل» ظاهريًا. هنا تُفحص قبل النشر لا بعده.
 *
 * ── ما لا يفعله ───────────────────────────────────────────────────
 * لا يُنشئ حساب Netlify ولا حساب Supabase ولا يعرف كلمات مرورهما: تسجيل
 * الدخول يجري في متصفحك عبر أداة Netlify نفسها، وكلمة قاعدة البيانات
 * تُسأل في سكربت Supabase وتذهب إلى `.env` وحدها.
 */

/** مجلد سطح المكتب — تقرأ هذا الملف أيقونتا المتجر واللوحة */
const SITE_URL_FILE = '../site-url.txt';

let stepNumber = 0;

function say(message: string) {
  console.log(message);
}

function step(title: string) {
  stepNumber += 1;
  console.log(`\n\x1b[1;33m[${stepNumber}/7] ${title}\x1b[0m`);
}

/** أمر تفاعلي: مخرجاته وأسئلته تصل المستخدم مباشرة (تسجيل دخول، إنشاء موقع) */
function runInteractive(
  command: string,
  args: string[],
  env?: Record<string, string>,
) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
    env: env ? { ...process.env, ...env } : process.env,
  });

  if (result.status !== 0) {
    throw new Error(`فشل الأمر: ${command} ${args.join(' ')}`);
  }
}

/** أمر صامت نحتاج ناتجه. يرمي عند الفشل ما لم يُطلب التسامح */
function capture(command: string, tolerant = false): string {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message?: string };

    /**
     * ⚠️ الناتج لا يُرمى مع رمز الفشل. `netlify status --json` يطبع JSON
     * سليمًا على stdout **ثم يخرج برمز 1** ما دام المجلد غير مربوط بموقع —
     * وهي الحالة الطبيعية قبل أول نشر. إرجاع نص فارغ هنا كان يُفهم «غير
     * مسجّل الدخول»، فيُعاد تسجيل دخول مكتمل أصلًا ثم يتوقف النشر عند
     * الخطوة ٣ بخطأ لا علاقة له بالسبب.
     */
    if (tolerant) return e.stdout ?? '';

    const detail = [e.stderr, e.stdout, e.message].filter(Boolean).join('\n  ');

    throw new Error(`فشل الأمر: ${command}\n  ${detail}`);
  }
}

/**
 * حالة أداة Netlify: مسجّل الدخول؟ والمجلد مربوط بموقع؟ وما رابطه؟
 *
 * ⚠️ الأسماء في الناتج بالشرطات (`site-url` لا `ssl_url`) — وهي غير أسماء
 * واجهة Netlify البرمجية. وعند عدم الربط تخرج الأداة برمز فشل **مع** طباعة
 * الحالة، فنقرأ الناتج على أي حال بدل معاملته خطأ.
 */
type NetlifyStatus = {
  loggedIn?: boolean;
  linked?: boolean;
  account?: { Email?: string; Name?: string } | null;
  siteData?: { 'site-name'?: string; 'site-url'?: string } | null;
};

function netlifyStatus(): NetlifyStatus {
  const output = capture('netlify status --json', true);

  // نقتطع الكائن من أول `{` إلى آخر `}`: بعض إصدارات الأداة تسبق JSON
  // بسطر ترحيب أو تتبعه بسطر خطأ، وكلاهما يكسر التحليل بلا داعٍ
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');

  if (start === -1 || end <= start) return {};

  try {
    return JSON.parse(output.slice(start, end + 1)) as NetlifyStatus;
  } catch {
    return {};
  }
}

/**
 * هل يستطيع هذا الحساب إنشاء رابط رمزي؟
 *
 * ⚠️ ويندوز يمنع الروابط الرمزية إلا لمدير أو مع «وضع المطوّر»، وإضافة
 * Next على Netlify تبنيها عند تحزيم الخادم. بدون هذا الفحص يكتشف التاجر
 * المنع بعد بناء كامل (دقائق) وبرسالة إنجليزية وسط مئات السطور:
 *   `EPERM: operation not permitted, symlink ... node_modules\@node-rs\argon2`
 * وهي رسالة تُقرأ كأن المشكلة في المتجر لا في إعداد ويندوز.
 */
function canCreateSymlinks(): boolean {
  if (platform !== 'win32') return true;

  const base = mkdtempSync(join(tmpdir(), 'monebra-symlink-'));
  const link = join(base, 'link');

  try {
    symlinkSync(base, link, 'dir');
    return true;
  } catch {
    return false;
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

/** يقرأ قيمة متغيّر من نص `.env` كما هو مكتوب في الملف */
function envValue(text: string, key: string): string {
  const match = text.match(new RegExp(`^${key}="?([^"\\n]*)"?$`, 'm'));
  return match?.[1] ?? '';
}

/** يكتب متغيّرًا في `.env` — يستبدله إن وُجد، ويضيفه إن لم يوجد */
function withEnv(text: string, key: string, value: string): string {
  return text.includes(`${key}=`)
    ? text.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}="${value}"`)
    : `${text.trimEnd()}\n${key}="${value}"\n`;
}

async function main() {
  say('\n\x1b[1m  نشر متجر مونيبرا على Netlify\x1b[0m');
  say('  ──────────────────────────────\n');

  // ── ١ · قاعدة البيانات ──
  /**
   * ⚠️ أخطر ما في النشر. SQLite ملف على قرص الدالة، والقرص يُمسح مع كل
   * نشر ومع كل نسخة جديدة من الدالة. الموقع سيبدو سليمًا: الصفحات تفتح
   * والطلبات تُقبل — ثم تختفي. فلا نكمل قبل PostgreSQL.
   */
  step('قاعدة البيانات');

  let envText = await readFile('.env', 'utf8');
  let databaseUrl = envValue(envText, 'DATABASE_URL');

  if (!databaseUrl.startsWith('postgres')) {
    say('  قاعدتك ما زالت SQLite محلية — لا تصلح للنشر.');
    say('  ننقلها الآن إلى Supabase (يسألك عن المشروع وكلمة مرور القاعدة).\n');

    const go = await ask('  نكمل؟ [نعم]: ', 'نعم');

    if (go !== 'نعم' && go.toLowerCase() !== 'yes') {
      throw new Error('أُلغي. النشر يحتاج قاعدة PostgreSQL.');
    }

    runInteractive('npx', ['tsx', 'scripts/setup-supabase.ts']);

    envText = await readFile('.env', 'utf8');
    databaseUrl = envValue(envText, 'DATABASE_URL');

    if (!databaseUrl.startsWith('postgres')) {
      throw new Error('لم تُنقل القاعدة. راجع setup-log.txt.');
    }
  }

  say('  ✓ PostgreSQL');

  /**
   * ⚠️ المنفذ 6543 هو Transaction pooler، وهو يكسر إنشاء الطلبات: المعاملة
   * التفاعلية التي تخصم المخزون بشرط `stock >= qty` تفقد ذرّيتها معه فيُباع
   * مخزون غير موجود. الفرق رقم واحد في الرابط، ولا يظهر أثره إلا عند أول
   * طلبين متزامنين — أي بعد فوات الأوان.
   */
  if (databaseUrl.includes(':6543')) {
    throw new Error(
      'رابط القاعدة يستعمل Transaction pooler (منفذ 6543).\n' +
        '  هذا يكسر إنشاء الطلبات وحارس البيع الزائد.\n' +
        '  استبدله برابط Session pooler (منفذ 5432) من لوحة Supabase.',
    );
  }

  // ── ٢ · أداة Netlify ──
  step('أداة Netlify');

  if (!capture('netlify --version', true)) {
    say('  غير مثبّتة — نثبّتها الآن (مرة واحدة، قد تستغرق دقيقة)...');
    runInteractive('npm', ['install', '-g', 'netlify-cli']);
  }

  const version = capture('netlify --version', true).trim();

  if (!version) {
    throw new Error(
      'تعذّر تشغيل أداة Netlify بعد تثبيتها.\n' +
        '  أغلق النافذة وافتحها من جديد ثم أعد المحاولة —\n' +
        '  المسار لا يُحدَّث في نافذة أوامر مفتوحة.',
    );
  }

  say(`  ✓ ${version}`);

  // ── ٣ · الحساب ──
  step('حسابك على Netlify');

  let state = netlifyStatus();

  if (!state.loggedIn) {
    say('  سيفتح متصفحك لتسجيل الدخول — أكمِل هناك ثم عُد.\n');
    runInteractive('netlify', ['login']);
    state = netlifyStatus();
  }

  if (!state.loggedIn) {
    throw new Error('لم يكتمل تسجيل الدخول إلى Netlify. أعد تشغيل الملف.');
  }

  say(`  ✓ ${state.account?.Email ?? 'مسجّل الدخول'}`);

  // ── ٤ · الموقع ──
  step('الموقع');

  if (!state.linked) {
    say('  لا يوجد موقع مرتبط بهذا المجلد. ننشئ واحدًا الآن.');
    say('  ستُسأل عن الفريق واسم الموقع — الاسم يصير جزءًا من الرابط.\n');
    // `sites:create` يربط المجلد بالموقع بعد إنشائه، فلا حاجة إلى `link`
    runInteractive('netlify', ['sites:create']);
    state = netlifyStatus();
  }

  const siteUrl = state.siteData?.['site-url'] ?? '';
  const siteName = state.siteData?.['site-name'] ?? '';

  if (!siteUrl.startsWith('https://')) {
    throw new Error(
      'تعذّر معرفة رابط الموقع.\n' +
        '  اربط المجلد بموقعك ثم أعد التشغيل: netlify link',
    );
  }

  say(`  ✓ ${siteName} — ${siteUrl}`);

  // ── ٥ · المتغيّرات ──
  step('متغيّرات الموقع');

  /**
   * ⚠️ سرّ الجلسات: قيمة `.env` للتطوير معروفة ومكتوبة في المشروع. لو
   * نُشرت كما هي لأمكن لمن يقرأها تزوير كوكي مدير. نولّد واحدًا عشوائيًا
   * عند أول نشر ونثبّته في `.env` — تغييره لاحقًا يُخرج كل من دخل.
   */
  let authSecret = envValue(envText, 'AUTH_SECRET');

  if (authSecret.length < 32 || authSecret.includes('dev-only')) {
    authSecret = randomBytes(48).toString('base64');
    await writeFile('.env', withEnv(envText, 'AUTH_SECRET', authSecret), 'utf8');
    say('  ✓ سرّ جلسات جديد (حُفظ في .env — لا ترفعه ولا ترسله)');
  }

  /**
   * `STORAGE_DRIVER` مضبوط في `netlify.toml` تحت `[build.environment]`،
   * وذلك يضمنه وقت البناء وحده. وهو يُقرأ **وقت الطلب** في
   * `src/lib/storage.ts`، فنضبطه هنا متغيّرًا للموقع أيضًا. بدونه ترجع
   * الدالة إلى القرص المؤقت فتضيع كل صورة يرفعها المدير — بلا رسالة خطأ.
   */
  const variables: Array<[string, string]> = [
    ['DATABASE_URL', databaseUrl],
    ['AUTH_SECRET', authSecret],
    ['NEXT_PUBLIC_SITE_URL', siteUrl],
    ['STORAGE_DRIVER', 'netlify-blobs'],
  ];

  for (const [key, value] of variables) {
    capture(`netlify env:set ${key} ${JSON.stringify(value)} --force`);
    say(`  ✓ ${key}`);
  }

  // ── ٦ · النشر ──
  step('البناء والنشر');

  say('  البناء يجري على جهازك ثم يُرفع الناتج. قد يستغرق دقائق.\n');

  // على ويندوز بلا صلاحية الوصلات الرمزية يتكفّل `flatten-junctions` بالأمر
  // في نهاية البناء. هذا السطر للعلم فقط عند قراءة السجل بعد فشل ما.
  if (!canCreateSymlinks()) {
    say('  (ويندوز يمنع الوصلات الرمزية — تُسطَّح الوصلات بعد البناء)\n');
  }

  /**
   * ⚠️ `NEXT_PUBLIC_SITE_URL` يُحقن في الصفحات **وقت البناء** لا وقت الطلب،
   * والبناء هنا محلي. فنمرّره صراحةً بدل الاعتماد على `.env` الذي يبقى
   * localhost لتشغيلك المحلي.
   */
  runInteractive('netlify', ['deploy', '--prod'], {
    DATABASE_URL: databaseUrl,
    AUTH_SECRET: authSecret,
    NEXT_PUBLIC_SITE_URL: siteUrl,
    STORAGE_DRIVER: 'netlify-blobs',
  });

  // ── ٧ · التحقق ──
  step('التحقق');

  const checks: Array<[string, string, (code: number) => boolean]> = [
    ['الواجهة', '/', (code) => code === 200],
    ['صفحة المنتجات', '/products', (code) => code === 200],
    // اللوحة محمية: 307 إلى صفحة الدخول هو الردّ الصحيح لزائر بلا جلسة
    ['لوحة الإدارة', '/admin', (code) => code === 307 || code === 200],
    ['خريطة الموقع', '/sitemap.xml', (code) => code === 200],
  ];

  let allPassed = true;

  for (const [label, path, accepts] of checks) {
    stdout.write(`  ${label}... `);

    const code = await fetch(`${siteUrl}${path}`, { redirect: 'manual' })
      .then((response) => response.status)
      .catch(() => 0);

    const passed = accepts(code);
    allPassed &&= passed;
    say(passed ? `✓ ${code}` : `✗ ${code || 'لا استجابة'}`);
  }

  // أيقونتا سطح المكتب تقرآن هذا الملف: وجود رابط فيه يحوّلهما من الخادم
  // المحلي إلى الموقع المنشور
  await writeFile(
    SITE_URL_FILE,
    `${siteUrl}\n\n` +
      '# رابط متجرك المنشور. تقرأه أيقونتا «متجر الزبائن» و«لوحة الإدارة»\n' +
      '# على سطح المكتب فتفتحان الموقع الحقيقي بدل الخادم المحلي.\n' +
      '# امسح السطر الأول لترجعا إلى التشغيل المحلي.\n',
    'utf8',
  );

  if (!allPassed) {
    throw new Error(
      'نُشر الموقع لكن بعض الصفحات لم تردّ كما يجب.\n' +
        '  افتح سجل النشر: netlify open --site  ← Deploys',
    );
  }

  say(`\n\x1b[1;32m  ✓ متجرك منشور: ${siteUrl}\x1b[0m`);
  say(`  اللوحة: ${siteUrl}/admin`);
  say('\n  بقي عليك:');
  say('   • سجّل الدخول للوحة وارفع صورة منتج، ثم أعد النشر وتأكد أنها باقية');
  say('   • أنشئ طلب تجربة ثم ألغِه ليعود المخزون');
  say('   • عدّل رسوم التوصيل ورقم واتساب ونصوص السياسات من اللوحة');
  say('   • عند ربط نطاقك الحقيقي: أعد تشغيل هذا الملف ليُحدَّث الرابط\n');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n\x1b[1;31m  ✗ ${message}\x1b[0m\n`);
  process.exit(1);
});
