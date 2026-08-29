import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * تفريغ شعار العلامة وبناء نسخه الجاهزة للاستخدام.
 *
 *   npm run brand -- <مسار الشعار الأصلي>
 *
 * ── لماذا سكربت بدل تحرير يدوي ─────────────────────────────────────
 * الشعار الأصلي **قرص دائري**: أيقونة فوق كلمة فوق كلمة. الهيدر يعرض
 * الشعار بارتفاع ٣٢–٣٦ بكسل، وعند تصغير قرص كامل إلى ٣٦ بكسل تصير كلمة
 * MONEBRA أقل من ٥ بكسل — أي بقعة غير مقروءة. الحل المعتمد في الهويات
 * البصرية هو **تشكيلة أفقية** (lockup): الأيقونة بجانب الكلمة، فيتضاعف
 * ارتفاع الحروف ثلاث مرات في نفس المساحة.
 *
 * ── كيف يُفرَّغ ─────────────────────────────────────────────────────
 * لا نحذف «اللون الأسود» — ذلك يترك حوافًا مسنّنة وهالة رمادية. بدل ذلك
 * نستغل أن الرسم **حبر داكن على قرص أبيض**، فنبني قناة الشفافية من عكس
 * الإضاءة: الأبيض ← شفاف تمامًا، والحبر ← معتم تمامًا، وما بينهما يرث
 * تنعيم الحواف الأصلي كما هو. النتيجة حواف نظيفة على أي خلفية.
 *
 * ثم نلوّن القناع بلون العلامة — فنحصل على نسخة عاجية للوضع الداكن
 * وأخرى حبرية للوضع الفاتح من نفس المصدر، بلا فقدان جودة.
 */

const OUT_DIR = path.join(process.cwd(), 'public', 'brand');

/** ألوان النسخ — من نفس tokens نظام التصميم في globals.css */
const COLORWAYS = {
  ivory: { r: 248, g: 245, b: 238 }, // --color-ivory-100 — للوضع الداكن
  ink: { r: 12, g: 35, b: 51 }, // كحلي الشعار الأصلي — للوضع الفاتح
  gold: { r: 198, g: 166, b: 100 }, // --color-gold-500 — للاستخدام المميّز
} as const;

type Rgb = { r: number; g: number; b: number };
type Box = { left: number; top: number; width: number; height: number };

/** صورة رمادية خام تمثّل الشفافية وحدها */
type Mask = { data: Uint8Array; width: number; height: number };

/**
 * يبني قناع الشفافية من الشعار الأصلي.
 *
 * القرص يُحدَّد هندسيًا ثم يُقلَّص قليلًا لاستبعاد حافته المنعّمة وظلّه
 * الخارجي — وإلا ظهرت حلقة شبحية حول الشعار على الخلفيات الفاتحة.
 */
async function buildMask(source: string): Promise<Mask> {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const lum = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  };

  // ── إيجاد القرص: أعرض صف مضيء يعطي القطر والمركز الأفقي ──
  let widest = { span: 0, left: 0, right: 0 };
  for (let y = 0; y < height; y += 1) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x += 1) {
      if (lum(x, y) > 90) {
        left = x;
        break;
      }
    }
    for (let x = width - 1; x >= 0; x -= 1) {
      if (lum(x, y) > 90) {
        right = x;
        break;
      }
    }
    if (left >= 0 && right - left > widest.span) {
      widest = { span: right - left, left, right };
    }
  }

  const cx = (widest.left + widest.right) / 2;
  const radius = widest.span / 2;

  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    if (lum(Math.round(cx), y) > 90) {
      top = y;
      break;
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    if (lum(Math.round(cx), y) > 90) {
      bottom = y;
      break;
    }
  }
  const cy = (top + bottom) / 2;

  if (!(radius > 0)) throw new Error('تعذّر العثور على القرص في الشعار');

  // ── معايرة الطرفين ──
  //
  // ⚠️ لا تفترض أن ورق القرص أبيض ٢٥٥: هنا وسيطه ٢٥٣، فلو عايرنا على ٢٥٥
  // لبقيت شفافية ≈٢ على كامل مساحة القرص — غير مرئية على خلفية داكنة، لكنها
  // تظهر **مستطيلًا شبحيًا** حول الشعار على أي خلفية فاتحة. لذلك تُقرأ
  // النقطة البيضاء من الورق نفسه (وسيط البكسلات المضيئة).
  const safe = radius - 12;
  const bright: number[] = [];
  let darkest = 255;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > safe * safe) continue;
      const value = lum(x, y);
      if (value < darkest) darkest = value;
      if (value > 200) bright.push(value);
    }
  }

  if (bright.length === 0) throw new Error('لا يوجد ورق فاتح داخل القرص');
  bright.sort((a, b) => a - b);
  const paper = bright[Math.floor(bright.length / 2)]!;

  // أرضية تقطع ذيل التنعيم الباهت جدًا ثم تُعاد الاستطالة كي لا يظهر تدرّج
  // مبتور عند الحواف
  const FLOOR = 6;
  const range = Math.max(1, paper - darkest);
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > safe * safe) continue;
      const raw = ((paper - lum(x, y)) / range) * 255;
      if (raw <= FLOOR) continue;
      const alpha = ((raw - FLOOR) / (255 - FLOOR)) * 255;
      mask[y * width + x] = alpha > 255 ? 255 : Math.round(alpha);
    }
  }

  console.log(
    `القرص: مركز (${cx.toFixed(0)}, ${cy.toFixed(0)}) نصف قطر ${radius.toFixed(0)} — ورق ${paper.toFixed(0)} حبر ${darkest.toFixed(0)}`,
  );

  return { data: mask, width, height };
}

/** أصغر مستطيل يحيط بكل ما هو غير شفاف داخل نطاق صفوف معيّن */
function boundingBox(mask: Mask, fromY = 0, toY = mask.height - 1): Box {
  let minX = mask.width;
  let maxX = -1;
  let minY = mask.height;
  let maxY = -1;

  for (let y = fromY; y <= toY; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      // عتبة ١٦ تتجاهل ذيل التنعيم الباهت الذي يضخّم الإطار بلا داعٍ
      if (mask.data[y * mask.width + x]! <= 16) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) throw new Error('نطاق فارغ — لا رسم فيه');
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * يقسم الرسم إلى مجموعات أفقية مفصولة بفراغ.
 * الفراغ بين الأيقونة والكلمة هو ما يسمح بفصلهما دون قصّ تقريبي.
 */
function inkBands(mask: Mask, minGap = 12): Array<[number, number]> {
  const bands: Array<[number, number]> = [];
  let start = -1;
  let gap = 0;

  for (let y = 0; y < mask.height; y += 1) {
    let ink = 0;
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x]! > 16) ink += 1;
    }

    if (ink > 2) {
      if (start < 0) start = y;
      gap = 0;
    } else if (start >= 0) {
      gap += 1;
      if (gap >= minGap) {
        bands.push([start, y - gap]);
        start = -1;
      }
    }
  }

  if (start >= 0) bands.push([start, mask.height - 1]);
  return bands.filter(([a, b]) => b - a > 3);
}

/** يحوّل جزءًا من القناع إلى PNG ملوّن بشفافية */
async function colorize(mask: Mask, box: Box, color: Rgb): Promise<Buffer> {
  const cropped = Buffer.alloc(box.width * box.height);
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      cropped[y * box.width + x] =
        mask.data[(box.top + y) * mask.width + box.left + x]!;
    }
  }

  return sharp({
    create: {
      width: box.width,
      height: box.height,
      channels: 3,
      background: color,
    },
  })
    .joinChannel(cropped, {
      raw: { width: box.width, height: box.height, channels: 1 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const source = process.argv[2];
  if (!source) {
    console.error('الاستخدام: npm run brand -- <مسار الشعار>');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const mask = await buildMask(source);

  const bands = inkBands(mask);
  console.log('مجموعات الرسم:', bands.map(([a, b]) => `${a}-${b}`).join('  '));

  if (bands.length < 2) throw new Error('لم يُعثر على أيقونة وكلمة منفصلتين');

  // الأيقونة = ما فوق أول مجموعة نصّية، الكلمة = من هناك إلى النهاية.
  //
  // ⚠️ لا تستخدم «أكبر فجوة» للفصل: الفجوة بين MONEBRA وPERFUMES في هذا
  // الشعار (٣٨ بكسل) أكبر من الفجوة بين القارورة وMONEBRA (٣٤)، فيقع القصّ
  // في المكان الخطأ. الفاصل الصحيح هو **شكل** المجموعة: سطر نصّي عريض
  // ومنخفض بطبعه، والأيقونة قريبة من المربّع. نسبة ٣ تفصل بينهما بأمان
  // (أضيق سطر هنا ١٥٫٣، وأعرض أيقونة أقل من ١).
  const TEXT_ASPECT = 3;
  const splitAt = bands.findIndex(([a, b]) => {
    const box = boundingBox(mask, a, b);
    return box.width / box.height > TEXT_ASPECT;
  });

  if (splitAt < 1) throw new Error('تعذّر فصل الأيقونة عن الكلمة');

  const markBox = boundingBox(mask, bands[0]![0], bands[splitAt - 1]![1]);
  const wordBox = boundingBox(mask, bands[splitAt]![0], bands.at(-1)![1]);

  console.log(`الأيقونة: ${markBox.width}×${markBox.height}`);
  console.log(`الكلمة:   ${wordBox.width}×${wordBox.height}`);

  const written: string[] = [];
  const write = async (name: string, buffer: Buffer) => {
    await writeFile(path.join(OUT_DIR, name), buffer);
    written.push(`${name} — ${(buffer.length / 1024).toFixed(0)}KB`);
  };

  for (const [tone, color] of Object.entries(COLORWAYS) as Array<[string, Rgb]>) {
    const markPng = await colorize(mask, markBox, color);
    const wordPng = await colorize(mask, wordBox, color);

    await write(`mark-${tone}.png`, markPng);
    await write(`wordmark-${tone}.png`, wordPng);

    // ── التشكيلة الأفقية ──
    // بلا تكبير: كل جزء يبقى بدقّته الأصلية فلا يفقد حدّته. الفجوة نسبة من
    // عرض الأيقونة لا رقمًا ثابتًا، كي تتناسب مع أي شعار يُبنى لاحقًا.
    const gap = Math.round(markBox.width * 0.34);
    const lockupHeight = Math.max(markBox.height, wordBox.height);
    const lockupWidth = markBox.width + gap + wordBox.width;

    const lockup = await sharp({
      create: {
        width: lockupWidth,
        height: lockupHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: markPng,
          left: 0,
          top: Math.round((lockupHeight - markBox.height) / 2),
        },
        {
          input: wordPng,
          left: markBox.width + gap,
          top: Math.round((lockupHeight - wordBox.height) / 2),
        },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();

    await write(`lockup-${tone}.png`, lockup);
  }

  // ── الشارة: القرص كما هو، بلا المربّع الأسود ──
  // للأفاتار على تيك توك وإنستغرام وأيقونة التطبيق، حيث القرص المصمَّت أنسب
  // من شعار مفرّغ يذوب في خلفية المنصّة.
  const meta = await sharp(source).metadata();
  const size = Math.min(meta.width!, meta.height!);
  const disc = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="#fff"/></svg>`,
  );

  // مرحلتان لا واحدة: sharp ينفّذ resize **قبل** composite مهما كان ترتيب
  // الاستدعاء، فلو دُمجتا لصار القرص أكبر من الصورة المصغَّرة ورُفض الدمج.
  const masked = await sharp(source)
    .extract({
      left: Math.round((meta.width! - size) / 2),
      top: Math.round((meta.height! - size) / 2),
      width: size,
      height: size,
    })
    .composite([{ input: disc, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // ١٠٢٤ يكفي أكبر أفاتار تطلبه المنصّات، وأصغر بكثير من الأصل
  const badge = await sharp(masked)
    .resize(1024, 1024, { fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await write('badge.png', badge);

  console.log(`\n✓ ${written.length} ملفًا في public/brand/`);
  for (const line of written) console.log(`   ${line}`);
}

main().catch((error) => {
  console.error('\n✗', error instanceof Error ? error.message : error);
  process.exit(1);
});
