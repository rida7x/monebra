import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { saveSettings, DEFAULT_SETTINGS, type StoreSettings } from '@/lib/settings';
import { invalidateSettings } from '@/lib/cache';
import { toMinor } from '@/lib/money';
import { logError } from '@/lib/logger';

/**
 * حفظ إعدادات المتجر.
 *
 * التحقق يعتمد على `DEFAULT_SETTINGS` كمرجع للأنواع: أي مفتاح غير معروف
 * يُتجاهل، وأي قيمة من نوع مختلف تُرفض. هذا يمنع إفساد الواجهة بقيمة
 * خاطئة، ويجعل إضافة إعداد جديد لا تتطلب تعديل هذا الملف.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin('settings.manage');

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
    }

    const patch: Partial<StoreSettings> = {};

    for (const [key, value] of Object.entries(body)) {
      if (!(key in DEFAULT_SETTINGS)) continue;

      const expected = typeof DEFAULT_SETTINGS[key as keyof StoreSettings];

      if (expected === 'string') {
        if (typeof value !== 'string') continue;
        // @ts-expect-error — تم التحقق من النوع أعلاه
        patch[key] = value.trim().slice(0, 2000);
      } else if (expected === 'number') {
        // عتبة التوصيل المجاني تصل بالصيغة المعروضة وتُخزَّن بالوحدة الصغرى
        const numeric =
          key === 'freeDeliveryThreshold'
            ? toMinorSafe(value)
            : Number(value);

        if (!Number.isFinite(numeric) || numeric < 0) continue;
        // @ts-expect-error — تم التحقق من النوع أعلاه
        patch[key] = numeric;
      } else if (expected === 'boolean') {
        if (typeof value !== 'boolean') continue;
        // @ts-expect-error — تم التحقق من النوع أعلاه
        patch[key] = value;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'لا توجد قيم صالحة للحفظ' },
        { status: 400 },
      );
    }

    await saveSettings(patch);
    invalidateSettings();

    return NextResponse.json({ ok: true, saved: Object.keys(patch).length });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'ليست لديك صلاحية تعديل الإعدادات' },
        { status: 403 },
      );
    }

    await logError(error, { path: '/api/admin/settings' });

    return NextResponse.json(
      { error: 'تعذّر حفظ الإعدادات. حاول مرة أخرى.' },
      { status: 500 },
    );
  }
}

function toMinorSafe(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return Number.NaN;
  return toMinor(numeric);
}
