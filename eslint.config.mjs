import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * إعداد ESLint المسطّح (Flat Config).
 *
 * `eslint-config-next` يوفّر إعدادًا مسطّحًا أصليًا منذ Next 16، فلا حاجة
 * إلى طبقة التوافق FlatCompat.
 *
 * ملاحظة: typescript-eslint لا يدعم TypeScript 7 بعد، ولهذا المشروع مثبّت
 * على TypeScript 6.0.x. راجع هذا القيد عند ترقية أدوات التطوير.
 */
const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'src/generated/**',
      'next-env.d.ts',
    ],
  },

  ...coreWebVitals,
  ...nextTypescript,

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

export default config;
