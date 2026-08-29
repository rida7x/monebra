import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * توليد أيقونات التطبيق.
 *
 * الأيقونة الافتراضية حرف M ذهبي على خلفية حبرية — هوية المتجر نفسها.
 * عند رفع المدير شعارًا خاصًا يُمرَّر مساره:
 *
 *   npm run icons -- public/uploads/logo.webp
 *
 * نسخة `maskable` تترك هامشًا آمنًا حول الحرف، لأن أندرويد يقصّ الأيقونة
 * إلى دائرة أو مربع مستدير حسب الجهاز — وبلا هامش يُقصّ جزء من الشعار.
 */

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'icons');
const BACKGROUND = '#08080a';
const GOLD = '#c6a664';

function letterSvg(size: number, padding: number): string {
  const fontSize = Math.round((size - padding * 2) * 0.62);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
  <text
    x="50%" y="50%"
    dy="0.35em"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${fontSize}"
    fill="${GOLD}"
  >M</text>
</svg>`;
}

async function main() {
  const source = process.argv[2];
  await mkdir(OUTPUT_DIR, { recursive: true });

  const targets = [
    { name: 'icon-192.png', size: 192, padding: 16 },
    { name: 'icon-512.png', size: 512, padding: 40 },
    // 20% هامش آمن — متطلب مواصفة maskable
    { name: 'icon-maskable-512.png', size: 512, padding: 102 },
    { name: 'apple-icon.png', size: 180, padding: 14 },
  ];

  for (const target of targets) {
    let image: Buffer;

    if (source) {
      const inner = target.size - target.padding * 2;

      image = await sharp({
        create: {
          width: target.size,
          height: target.size,
          channels: 4,
          background: BACKGROUND,
        },
      })
        .composite([
          {
            input: await sharp(source)
              .resize(inner, inner, { fit: 'inside' })
              .toBuffer(),
            gravity: 'center',
          },
        ])
        .png()
        .toBuffer();
    } else {
      image = await sharp(Buffer.from(letterSvg(target.size, target.padding)))
        .png()
        .toBuffer();
    }

    await writeFile(path.join(OUTPUT_DIR, target.name), image);
    console.log(`✓ ${target.name} (${target.size}px)`);
  }

  console.log(
    source
      ? '\nأُنشئت الأيقونات من الشعار المُمرَّر.'
      : '\nأُنشئت أيقونات افتراضية. لاستخدام شعارك:\n  npm run icons -- <مسار الشعار>',
  );
}

main().catch((error) => {
  console.error('✗ فشل توليد الأيقونات:', error);
  process.exit(1);
});
