import { prisma } from '@/lib/db';

/**
 * تسجيل الأخطاء.
 *
 * قاعدتان:
 *  1. المستخدم لا يرى أبدًا رسالة تقنية أو Stack Trace — يرى جملة عربية
 *     مفهومة، والتفاصيل تُحفظ هنا ليراها المدير في /admin/logs.
 *  2. التسجيل نفسه لا يجوز أن يُسقط الطلب: إذا فشلت الكتابة في قاعدة
 *     البيانات (وهو الاحتمال الأرجح عند خطأ اتصال) نكتفي بالطباعة.
 */

export type ErrorContext = {
  path?: string;
  [key: string]: unknown;
};

const MAX_MESSAGE = 1000;
const MAX_STACK = 4000;
const MAX_CONTEXT = 2000;

export async function logError(
  error: unknown,
  context: ErrorContext = {},
  level: 'error' | 'warn' = 'error',
): Promise<void> {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'خطأ غير معروف';

  const stack = error instanceof Error ? error.stack : undefined;
  const { path, ...rest } = context;

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${level}]`, path ?? '', message, rest);
  }

  try {
    await prisma.errorLog.create({
      data: {
        level,
        message: message.slice(0, MAX_MESSAGE),
        stack: stack?.slice(0, MAX_STACK),
        path: path?.slice(0, 255),
        context:
          Object.keys(rest).length > 0
            ? safeStringify(rest).slice(0, MAX_CONTEXT)
            : null,
      },
    });
  } catch {
    // قاعدة البيانات غير متاحة — لا نُسقط الطلب لأجل سجل
    console.error('[logger] تعذّر حفظ السجل:', message);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[غير قابل للتسلسل]';
  }
}
