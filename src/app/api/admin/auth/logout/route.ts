import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth';
import { logError } from '@/lib/logger';

/**
 * تسجيل الخروج.
 *
 * POST لا GET: لو كان GET لاستطاع موقع خارجي إخراج المدير بمجرد تحميل
 * صورة تشير إلى هذا المسار.
 */
export async function POST() {
  try {
    await logout();
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logError(error, { path: '/api/admin/auth/logout' });
    return NextResponse.json({ error: 'تعذّر تسجيل الخروج' }, { status: 500 });
  }
}
