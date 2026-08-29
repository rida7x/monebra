import { hash, verify } from '@node-rs/argon2';

/**
 * تجزئة كلمات المرور بـ Argon2id.
 *
 * المعاملات مختارة لتستغرق التجزئة ~100ms على خادم عادي — بطيئة بما يكفي
 * لتعطيل هجمات التخمين، وسريعة بما يكفي لتسجيل دخول مريح.
 */
const OPTIONS = {
  memoryCost: 19_456, // 19 MiB — توصية OWASP
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`,
    );
  }
  return hash(plain, OPTIONS);
}

/**
 * يتحقق من كلمة المرور. لا يرمي استثناءً عند الفشل — يعيد false، حتى لا
 * يفرّق المهاجم بين «مستخدم غير موجود» و«كلمة مرور خاطئة» عبر رسائل الخطأ.
 */
export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    return false;
  }
}

/** فحص بسيط لقوة كلمة المرور — يُستخدم عند إنشاء الحسابات */
export function passwordIssues(plain: string): string[] {
  const issues: string[] = [];

  if (plain.length < MIN_PASSWORD_LENGTH) {
    issues.push(`يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} أحرف`);
  }
  if (!/[a-z]/.test(plain) && !/[A-Z]/.test(plain)) {
    issues.push('يجب أن تحتوي على حرف لاتيني واحد على الأقل');
  }
  if (!/\d/.test(plain)) {
    issues.push('يجب أن تحتوي على رقم واحد على الأقل');
  }

  return issues;
}
