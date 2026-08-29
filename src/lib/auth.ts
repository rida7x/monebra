import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import {
  ROLE_PERMISSIONS,
  ADMIN_ROLES,
  type AdminRole,
  type Permission,
} from '@/lib/constants';

/**
 * مصادقة لوحة التحكم.
 *
 * جلسات معتمة (opaque) لا JWT:
 *  • نولّد رمزًا عشوائيًا 32 بايت، نرسله للمتصفح في كوكي HttpOnly،
 *    ونخزّن **تجزئته** فقط في قاعدة البيانات
 *  • تسريب قاعدة البيانات لا يعطي المهاجم رموزًا صالحة
 *  • تسجيل الخروج أو تعطيل الحساب يُبطل الجلسة **فورًا** — وهو ما لا
 *    يوفّره JWT الذي يبقى صالحًا حتى انتهاء صلاحيته
 *
 * الثمن: استعلام واحد لكل طلب إداري. مقبول تمامًا لعدد مديرين محدود،
 * ومفهرس على `tokenHash`.
 */

const COOKIE_NAME = 'monebra_admin_session';
const SESSION_DAYS = 7;
/** تمديد الجلسة عند النشاط إن بقي أقل من يومين — يمنع خروجًا مفاجئًا */
const REFRESH_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000;

export type AdminSessionUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  permissions: readonly Permission[];
};

// ─────────────────────────── الرموز ───────────────────────────

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ─────────────────────────── الصلاحيات ───────────────────────────

/**
 * صلاحيات المستخدم = صلاحيات دوره + أي صلاحيات إضافية في
 * `permissionsOverride`. التوسع مستقبلًا يتم بإضافة صلاحيات للمستخدم
 * دون إنشاء أدوار جديدة.
 */
export function resolvePermissions(
  role: string,
  overrideJson: string | null,
): readonly Permission[] {
  const validRole = ADMIN_ROLES.includes(role as AdminRole)
    ? (role as AdminRole)
    : 'orders_manager';

  const base = ROLE_PERMISSIONS[validRole];

  if (!overrideJson) return base;

  try {
    const extra = JSON.parse(overrideJson);
    if (!Array.isArray(extra)) return base;

    return [...new Set([...base, ...extra.filter((p) => typeof p === 'string')])] as Permission[];
  } catch {
    return base;
  }
}

export function hasPermission(
  user: AdminSessionUser | null,
  permission: Permission,
): boolean {
  return user?.permissions.includes(permission) ?? false;
}

/** يتحقق من امتلاك المستخدم *أي* صلاحية من القائمة */
export function hasAnyPermission(
  user: AdminSessionUser | null,
  permissions: readonly Permission[],
): boolean {
  if (!user) return false;
  return permissions.some((permission) => user.permissions.includes(permission));
}

// ─────────────────────────── القراءة ───────────────────────────

/**
 * المستخدم الحالي من الكوكي، أو null.
 *
 * ملفوفة بـ `cache` فتُنفَّذ مرة واحدة لكل طلب مهما تكرر استدعاؤها في
 * التخطيط والصفحة والمكوّنات.
 */
export const getCurrentAdmin = cache(async (): Promise<AdminSessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      admin: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          permissionsOverride: true,
        },
      },
    },
  });

  if (!session) return null;

  // جلسة منتهية أو حساب عُطّل بعد تسجيل الدخول ⇒ لا وصول
  if (session.expiresAt <= new Date() || !session.admin.isActive) {
    await prisma.adminSession
      .delete({ where: { id: session.id } })
      .catch(() => undefined);
    return null;
  }

  // تمديد صامت عند اقتراب الانتهاء
  if (session.expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS) {
    await prisma.adminSession
      .update({
        where: { id: session.id },
        data: { expiresAt: expiryDate() },
      })
      .catch(() => undefined);
  }

  return {
    id: session.admin.id,
    name: session.admin.name,
    email: session.admin.email,
    role: session.admin.role as AdminRole,
    permissions: resolvePermissions(
      session.admin.role,
      session.admin.permissionsOverride,
    ),
  };
});

/**
 * يعيد المستخدم أو يرمي إن لم يكن مسجّلًا/مخوّلًا.
 * تستدعيها كل صفحة وكل نقطة نهاية إدارية — لا استثناءات.
 */
export async function requireAdmin(
  permission?: Permission,
): Promise<AdminSessionUser> {
  const user = await getCurrentAdmin();

  if (!user) throw new UnauthorizedError();
  if (permission && !user.permissions.includes(permission)) {
    throw new ForbiddenError(permission);
  }

  return user;
}

/**
 * حارس **الصفحات** — مقابل `requireAdmin` الخاص بنقاط النهاية.
 *
 * الفرق مقصود: نقطة النهاية ترمي فتُعيد 403 بصيغة JSON يفهمها الطلب
 * البرمجي، أما الصفحة فترمي خطأً غير ملتقَط يظهر للمدير كـ«خطأ في الخادم»
 * وهي رسالة مضللة — سبب المنع صلاحية لا عطل. لذلك نحوّله هنا إلى صفحة
 * توضّح له ما ينقصه ومن يستطيع منحه إياه.
 *
 * لا نستخدم `forbidden()` من Next لأنها ما تزال تجريبية وتتطلب تفعيل
 * `authInterrupts` — والمتجر يعمل على واجهات مستقرة فقط.
 */
export async function requirePageAccess(
  permission?: Permission,
): Promise<AdminSessionUser> {
  const user = await getCurrentAdmin();

  // ⚠️ `expired=1` ضروري: الوسيط (proxy) يعمل على الحافة بلا قاعدة بيانات،
  // فلا يعرف إلا **وجود** الكوكي لا صلاحيته، ويحوّل كل من يحمل كوكيًا من
  // صفحة الدخول إلى اللوحة. بكوكي منتهٍ أو ملفَّق تنشأ حلقة تحويل لا نهائية
  // تمنع المدير من تسجيل الدخول أصلًا. هذه العلامة تخبر الوسيط أن الكوكي
  // فاسد فيحذفه ويسمح بعرض صفحة الدخول.
  if (!user) redirect('/admin/login?expired=1');

  if (permission && !user.permissions.includes(permission)) {
    redirect(`/admin/denied?p=${encodeURIComponent(permission)}`);
  }

  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(readonly permission: string) {
    super('forbidden');
    this.name = 'ForbiddenError';
  }
}

// ─────────────────────────── تسجيل الدخول ───────────────────────────

export type LoginResult =
  | { ok: true; user: AdminSessionUser }
  | { ok: false; message: string; retryAfterSeconds?: number };

/**
 * عدد المحاولات الفاشلة المسموح بها قبل الحظر المؤقت.
 *
 * يُضاعَف في بيئة الاختبارات الآلية فقط (`RATE_LIMIT_MULTIPLIER`) لأن كل
 * الطلبات تأتي من نفس العنوان فتستنفد الحصة. قيمة الإنتاج تبقى ٦.
 */
const ATTEMPT_WINDOW_MINUTES = 15;

function maxAttempts(): number {
  const raw = Number(process.env.RATE_LIMIT_MULTIPLIER);
  const factor = Number.isFinite(raw) && raw >= 1 ? Math.min(raw, 200) : 1;
  return 6 * factor;
}

export async function login(
  email: string,
  password: string,
  context: { ip: string | null; userAgent: string | null },
): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);

  // ── حظر التخمين ──
  // نعدّ الفاشلة بالبريد **وبالـ IP** معًا: الأول يحمي حسابًا بعينه،
  // والثاني يمنع تجربة عدة حسابات من نفس المصدر
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { identifier: normalizedEmail, success: false, createdAt: { gte: since } },
    }),
    context.ip
      ? prisma.loginAttempt.count({
          where: { identifier: `ip:${context.ip}`, success: false, createdAt: { gte: since } },
        })
      : Promise.resolve(0),
  ]);

  const limit = maxAttempts();

  if (byEmail >= limit || byIp >= limit * 2) {
    return {
      ok: false,
      message: `محاولات كثيرة فاشلة. حاول بعد ${ATTEMPT_WINDOW_MINUTES} دقيقة.`,
      retryAfterSeconds: ATTEMPT_WINDOW_MINUTES * 60,
    };
  }

  const admin = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      passwordHash: true,
      isActive: true,
      permissionsOverride: true,
    },
  });

  // نتحقق من كلمة المرور حتى لو لم يوجد الحساب، بتجزئة وهمية، حتى لا
  // يكشف فرق زمن الاستجابة أي البريدين مسجّل فعلًا
  const passwordOk = admin
    ? await verifyPassword(admin.passwordHash, password)
    : await burnTime(password);

  if (!admin || !passwordOk || !admin.isActive) {
    await recordAttempt(normalizedEmail, false, context.ip);
    return { ok: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
  }

  await recordAttempt(normalizedEmail, true, context.ip);

  // ── إنشاء الجلسة ──
  const token = generateToken();

  await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      tokenHash: hashToken(token),
      expiresAt: expiryDate(),
      ip: context.ip,
      userAgent: context.userAgent?.slice(0, 500) ?? null,
    },
  });

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  return {
    ok: true,
    user: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role as AdminRole,
      permissions: resolvePermissions(admin.role, admin.permissionsOverride),
    },
  };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    // الحذف من قاعدة البيانات هو الإبطال الحقيقي — حذف الكوكي وحده
    // يترك الرمز صالحًا لمن نسخه
    await prisma.adminSession
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }

  store.delete(COOKIE_NAME);
}

/** يُنهي كل جلسات مستخدم — عند تغيير كلمة المرور أو تعطيل الحساب */
export async function revokeAllSessions(adminId: string): Promise<void> {
  await prisma.adminSession.deleteMany({ where: { adminId } });
}

/** ينظّف الجلسات المنتهية — يُستدعى عند تسجيل الدخول */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.adminSession
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);
}

// ─────────────────────────── مساعدات ───────────────────────────

function expiryDate(): Date {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

async function recordAttempt(
  identifier: string,
  success: boolean,
  ip: string | null,
): Promise<void> {
  const rows = [{ identifier, success, ip }];
  if (ip) rows.push({ identifier: `ip:${ip}`, success, ip });

  await prisma.loginAttempt
    .createMany({ data: rows })
    .catch(() => undefined);
}

/**
 * تجزئة وهمية لمساواة زمن الاستجابة بين «حساب غير موجود» و«كلمة مرور
 * خاطئة». بدونها يستطيع المهاجم معرفة البُرد المسجّلة من فرق التوقيت.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$ZmFrZWhhc2hmYWtlaGFzaGZha2VoYXNoZmFrZWg';

async function burnTime(password: string): Promise<false> {
  await verifyPassword(DUMMY_HASH, password);
  return false;
}

/** مقارنة ثابتة الزمن — للاستخدام مع أي أسرار مستقبلية */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** عنوان العميل من ترويسات الطلب — للتسجيل وحظر التخمين */
export async function requestContext(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');

  return {
    ip: forwarded?.split(',')[0]?.trim() ?? headerList.get('x-real-ip'),
    userAgent: headerList.get('user-agent'),
  };
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
