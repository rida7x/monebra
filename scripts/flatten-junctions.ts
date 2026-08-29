import { cpSync, existsSync, lstatSync, readdirSync, realpathSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:process';

/**
 * يحوّل الوصلات داخل `.next` إلى مجلدات حقيقية — على ويندوز فقط.
 *
 *   يعمل تلقائيًا في نهاية `npm run build`
 *
 * ── المشكلة ───────────────────────────────────────────────────────
 * Next يضع الحزم الأصلية (sharp، pg، argon2، عميل Prisma…) في مجلدات
 * `node_modules` داخل `.next` كـ **junctions**: وصلات لا تحتاج صلاحية خاصة
 * على ويندوز. ثم تنسخ إضافة `@netlify/plugin-nextjs` تلك المجلدات بـ
 * `cp(..., { verbatimSymlinks: true })`، أي «أعِد إنشاء كل وصلة وصلةً».
 * وإعادة الإنشاء تجري كـ **symlink** لا junction، وويندوز يمنع الـ symlink
 * إلا لمدير أو مع «وضع المطوّر». فيموت النشر بعد بناء كامل بـ:
 *
 *   EPERM: operation not permitted, symlink
 *     node_modules\@node-rs\argon2 → …\___netlify-server-handler\…
 *
 * ── الحل ──────────────────────────────────────────────────────────
 * نستبدل كل وصلة بنسخة حقيقية من محتواها قبل أن تصل الإضافة. عندها لا يبقى
 * ما يُنسخ كوصلة، فالنسخ يصير نسخ ملفات عاديًا — وينجح النشر بلا صلاحية
 * مدير وبلا تغيير أي إعداد في ويندوز.
 *
 * الناتج النهائي مطابق لما تنتجه خوادم Netlify على لينكس: الملفات نفسها
 * تصل إلى الدالة في الحالتين، والفرق في طريقة وصولها لا في محتواها.
 *
 * ⚠️ المسح الشامل مقصود. الوصلات ليست في مكان واحد: `.next/node_modules`
 * و`.next/standalone/.next/node_modules` نسختان منها، والإضافة تنسخ من
 * الثانية. معالجة الأولى وحدها تُنتج بناءً يبدو ناجحًا ثم يفشل عند النشر
 * بنفس الرسالة تمامًا — وهو ما حدث فعلًا.
 *
 * ⚠️ الإزالة بـ `rmdirSync` لا `rmSync({ recursive: true })`. الأولى تحذف
 * الوصلة وحدها؛ والثانية قد تتبعها فتحذف **محتوى `node_modules` الأصلي**
 * الذي تشير إليه. الفرق بين خطوة بناء ومسح مجلد الحزم كله.
 */

const ROOT = '.next';

/** مجلد خادم التطوير: لا يُنشر، ونسخ حزمه الثقيلة هدر خالص */
const SKIP = new Set(['dev']);

function flatten(dir: string, found: string[]) {
  let entries: string[];

  try {
    entries = readdirSync(dir);
  } catch {
    return; // مجلد اختفى أثناء المسح — لا يعنينا
  }

  for (const entry of entries) {
    if (SKIP.has(entry)) continue;

    const path = join(dir, entry);
    const stats = lstatSync(path);

    if (stats.isSymbolicLink()) {
      const target = realpathSync(path);

      rmdirSync(path);
      cpSync(target, path, { recursive: true, dereference: true });
      found.push(path);
      continue; // النسخة الجديدة خالية من الوصلات — لا حاجة لدخولها
    }

    if (stats.isDirectory()) flatten(path, found);
  }
}

function main() {
  if (platform !== 'win32' || !existsSync(ROOT)) return;

  const found: string[] = [];
  flatten(ROOT, found);

  if (found.length > 0) {
    console.log(
      `  ✓ ${found.length} وصلة حُوّلت إلى مجلدات (لأجل النشر من ويندوز)`,
    );
  }
}

main();
