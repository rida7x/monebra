import 'server-only';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * تخزين الصور.
 *
 * كل صورة تمرّ عبر sharp قبل الحفظ، وهذا يحقق ثلاثة أشياء دفعة واحدة:
 *  1. **الأمان**: sharp يفشل على أي ملف ليس صورة حقيقية مهما كان امتداده
 *     أو نوعه المعلن — فلا يمكن رفع سكربت باسم product.jpg
 *  2. **الحجم**: التحويل إلى WebP يقلّص الحجم إلى الثلث تقريبًا، وهو فارق
 *     محسوس على شبكات الهاتف الضعيفة
 *  3. **الاتساق**: أبعاد قصوى موحّدة تمنع رفع صورة 8000px تُبطئ الصفحة
 *
 * ── المزوّدان ─────────────────────────────────────────────────────
 * `local` — يكتب في `public/uploads`. يعمل على خادم بقرص دائم (VPS).
 * `netlify-blobs` — يكتب في مخزن Netlify.
 *
 * ⚠️ لماذا لزم مزوّد ثانٍ: على استضافة بلا حالة يكون قرص الدالة مؤقتًا،
 * فصورة يرفعها المدير اليوم تختفي عند أول نشر — بلا رسالة خطأ. المزوّد
 * يُختار من `STORAGE_DRIVER`، فلا تعديل في الكود عند تبديل الاستضافة.
 */

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

/**
 * بادئة المسار العام تختلف بين المزوّدين:
 *   local — `/uploads/x.webp` يخدمه Next من مجلد public مباشرة
 *   blobs — `/api/images/x.webp` لأن مخزن Netlify ليس له رابط عام، فتمرّ
 *           الصورة عبر مسار يقرأها ويخدمها مع ترويسات تخزين مؤقت طويلة
 */
const LOCAL_PREFIX = '/uploads';
const BLOBS_PREFIX = '/api/images';

/** اسم المخزن في Netlify Blobs */
export const BLOB_STORE = 'product-images';

export type StorageDriver = 'local' | 'netlify-blobs';

export function storageDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER === 'netlify-blobs'
    ? 'netlify-blobs'
    : 'local';
}

function publicPrefix(): string {
  return storageDriver() === 'netlify-blobs' ? BLOBS_PREFIX : LOCAL_PREFIX;
}

/** استيراد كسول: الحزمة لا تُحمَّل على خادم لا يستخدم Blobs أصلًا */
async function blobStore() {
  const { getStore } = await import('@netlify/blobs');
  return getStore(BLOB_STORE);
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 ميجابايت
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 82;

export const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export type SaveResult =
  | { ok: true; url: string; width: number; height: number; bytes: number }
  | { ok: false; error: string };

export async function saveImage(file: File): Promise<SaveResult> {
  if (file.size === 0) {
    return { ok: false, error: 'الملف فارغ' };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `حجم الصورة يتجاوز ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} ميجابايت`,
    };
  }

  // النوع المعلن فحص أولي رخيص فقط — التحقق الحقيقي هو نجاح sharp أدناه
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
    return { ok: false, error: 'نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP' };
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());

    const processed = await sharp(input, { failOn: 'error' })
      .rotate() // يحترم اتجاه EXIF — بدونه تظهر صور الهاتف مقلوبة
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    // اسم عشوائي: يمنع تخمين مسارات الصور، ويمنع الكتابة فوق ملف موجود،
    // ويمنع أي محاولة تجاوز مسار عبر اسم الملف الأصلي
    const name = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.webp`;

    if (storageDriver() === 'netlify-blobs') {
      const store = await blobStore();
      // `BlobInput` يقبل ArrayBuffer لا Uint8Array — و`Buffer` قد يكون
      // نافذة على مخزن أكبر، فنقتطع نطاقه بالضبط بدل تمرير الكامل
      const bytes = processed.data.buffer.slice(
        processed.data.byteOffset,
        processed.data.byteOffset + processed.data.byteLength,
      ) as ArrayBuffer;

      await store.set(name, bytes, {
        metadata: { contentType: 'image/webp' },
      });
    } else {
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(path.join(UPLOAD_DIR, name), processed.data);
    }

    return {
      ok: true,
      url: `${publicPrefix()}/${name}`,
      width: processed.info.width,
      height: processed.info.height,
      bytes: processed.info.size,
    };
  } catch {
    // sharp يرمي على أي ملف ليس صورة صالحة — نعامله كرفض لا كخطأ نظام
    return {
      ok: false,
      error: 'تعذّرت قراءة الصورة. تأكد أن الملف صورة صالحة.',
    };
  }
}

/**
 * يستخرج اسم ملف آمنًا من مسار صورة مرفوعة، أو `null` إن كان المسار غريبًا.
 *
 * ⚠️ الحارس الأساسي ضد تجاوز المسار: بدونه يمكن تمرير `../../` والوصول إلى
 * ملفات خارج مجلد الرفع — قراءةً في مسار الخدمة وحذفًا في `removeImage`.
 * يقبل بادئتَي المزوّدين معًا كي تبقى الصور القديمة قابلة للحذف بعد تبديل
 * الاستضافة.
 */
export function uploadedFileName(url: string): string | null {
  const isUpload =
    url.startsWith(`${LOCAL_PREFIX}/`) || url.startsWith(`${BLOBS_PREFIX}/`);
  if (!isUpload) return null;

  const name = path.basename(url);
  if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
    return null;
  }

  // أسماؤنا مولَّدة بنمط ثابت — أي شيء آخر ليس ملفًا رفعناه نحن
  if (!/^[a-z0-9]+-[a-f0-9]{16}\.webp$/i.test(name)) return null;

  return name;
}

/** حذف صورة مرفوعة. يتجاهل ما ليس صورة رفعها المتجر. */
export async function removeImage(url: string): Promise<void> {
  const name = uploadedFileName(url);
  if (!name) return;

  if (storageDriver() === 'netlify-blobs') {
    const store = await blobStore();
    await store.delete(name).catch(() => undefined);
    return;
  }

  const target = path.join(UPLOAD_DIR, name);

  // حارس إضافي: المسار النهائي يجب أن يبقى داخل مجلد الرفع
  if (!target.startsWith(UPLOAD_DIR)) return;

  await unlink(target).catch(() => undefined);
}

/** يقرأ صورة من مخزن Blobs — يستخدمه مسار خدمة الصور وحده */
export async function readBlobImage(name: string): Promise<Buffer | null> {
  const store = await blobStore();
  const data = await store.get(name, { type: 'arrayBuffer' }).catch(() => null);
  return data ? Buffer.from(data) : null;
}
