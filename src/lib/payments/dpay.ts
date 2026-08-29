import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { toMajor } from '@/lib/money';

/**
 * عميل بوّابة DPay.
 *
 * DPay بوّابة ليبية واحدة تجمع عدّة مزوّدين (موبي كاش، أدفعلي، صدّاد،
 * بطاقات المصارف). نتعامل معها وحدها بدل ربط كل مزوّد على حدة.
 *
 * ── المسار ────────────────────────────────────────────────────────
 *   ١. نفتح جلسة بالمبلغ وبيانات الزبون  → `openSession`
 *   ٢. يصل الزبون رمز تحقق برسالة نصية
 *   ٣. يُدخل الرمز فنؤكّده                → `verifySession`
 *   ٤. يصلنا webhook موقّع يؤكّد الدفع     → `verifyWebhookSignature`
 *
 * الخطوة الرابعة هي مصدر الحقيقة الوحيد لتعليم الطلب مدفوعًا. نجاح الخطوة
 * الثالثة مؤشّر لطيف للزبون لا إثبات: ردّ من المتصفح لا يُبنى عليه مال.
 *
 * ── ما لا يُقرأ من العميل ─────────────────────────────────────────
 * المبلغ يُقرأ من الطلب في قاعدتنا لا من الطلبية القادمة من المتصفح. وإلا
 * لأمكن لأي زبون أن يدفع دينارًا مقابل سلة بألف.
 *
 * الوثائق: https://dpay.ly/docs/api
 */

const BASE_LIVE = 'https://dpay.ly/api';
const BASE_SANDBOX = 'https://dpay.ly/api/sandbox';

/** أسماء مزوّدي DPay كما تكتبها الوثائق — لا تُترجم ولا تُغيَّر */
export const DPAY_METHODS = {
  mobicash: 'mobicash',
  edfali: 'edfali',
} as const;

export type DpayMethod = keyof typeof DPAY_METHODS;

export function dpayToken(): string | undefined {
  return process.env.DPAY_API_TOKEN;
}

export function dpayWebhookSecret(): string | undefined {
  return process.env.DPAY_WEBHOOK_SECRET;
}

/**
 * الوضع التجريبي.
 *
 * ⚠️ الافتراضي **تجريبي**، والوضع الحقيقي يحتاج `DPAY_MODE=live` صراحةً.
 * الاتجاه مقصود: نسيان المتغيّر يعني أموالًا وهمية في بيئة اختبار، وعكسه
 * يعني تحصيلًا حقيقيًا من زبائن أثناء التجربة.
 */
export function dpaySandbox(): boolean {
  return process.env.DPAY_MODE !== 'live';
}

function baseUrl(): string {
  return dpaySandbox() ? BASE_SANDBOX : BASE_LIVE;
}

export type OpenSessionInput = {
  method: DpayMethod;
  /** بالوحدة الصغرى كما تُخزَّن عندنا — يُحوَّل هنا إلى دينار */
  amountMinor: number;
  /** أدفعلي: رقم هاتف الزبون */
  customerMobile?: string;
  /** موبي كاش: رقم البطاقة (٧ أرقام) */
  cardNumber?: string;
  description?: string;
  /** يعود إلينا كما هو في الـ webhook — نضع فيه رقم الطلب */
  data?: Record<string, string>;
};

export type DpaySession = {
  session_id: number;
  status: string;
  amount: number;
  currency?: string;
  total?: number;
  expired_at?: string;
};

export type DpayResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

const TIMEOUT_MS = 20_000;

async function call<T>(
  path: string,
  body: unknown,
  method: 'GET' | 'POST' = 'POST',
): Promise<DpayResult<T>> {
  const token = dpayToken();

  if (!token) {
    return { ok: false, error: 'بوّابة الدفع غير مهيّأة' };
  }

  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const payload = (await response.json().catch(() => null)) as
      | (T & { message?: string; errors?: Record<string, string[]> })
      | null;

    if (!response.ok || !payload) {
      /**
       * ⚠️ رسالة DPay تُعرض للزبون كما هي عمدًا: أخطاؤها من نوع «رصيد غير
       * كافٍ» و«رمز خاطئ» — وهي ما يحتاج الزبون سماعه بالضبط. إخفاؤها خلف
       * «تعذّر الدفع» يجعله يعيد المحاولة بلا فهم.
       */
      const detail =
        payload?.errors && Object.values(payload.errors)[0]?.[0]
          ? Object.values(payload.errors)[0]![0]!
          : payload?.message;

      return {
        ok: false,
        error: detail || 'تعذّر إتمام العملية مع بوّابة الدفع',
        status: response.status,
      };
    }

    return { ok: true, data: payload };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';

    return {
      ok: false,
      error: timedOut
        ? 'بوّابة الدفع لم تستجب. تحقق من طلبك قبل إعادة المحاولة.'
        : 'تعذّر الوصول إلى بوّابة الدفع',
    };
  }
}

export async function openSession(
  input: OpenSessionInput,
): Promise<DpayResult<DpaySession>> {
  const body: Record<string, unknown> = {
    pay_method: DPAY_METHODS[input.method],
    // الوثائق: المبلغ بالدينار بكسور عشرية، والحدّ الأدنى 0.01
    amount: toMajor(input.amountMinor),
  };

  if (input.customerMobile) body.customer_mobile = input.customerMobile;
  if (input.cardNumber) body.card_number = input.cardNumber;
  if (input.description) body.description = input.description;
  if (input.data) body.data = input.data;

  return call<DpaySession>('/payment/sessions/open', body);
}

export async function verifySession(
  sessionId: number,
  otp: string,
): Promise<DpayResult<DpaySession>> {
  return call<DpaySession>('/payment/sessions/verify', {
    session_id: sessionId,
    otp,
  });
}

export async function getSession(
  sessionId: number,
): Promise<DpayResult<DpaySession>> {
  return call<DpaySession>(`/payment/sessions/${sessionId}`, null, 'GET');
}

/** أقصى عمر مقبول لطابع الـ webhook — الوثائق: خمس دقائق */
const MAX_WEBHOOK_AGE_SECONDS = 5 * 60;

/**
 * يتحقق من توقيع الـ webhook.
 *
 * التوقيع = `hmac_sha256(timestamp + '.' + raw_body, secret)` بالسداسي.
 *
 * ⚠️ ثلاثة شروط لا يُستغنى عن أيّها:
 *  1. **الجسم الخام** لا المُحلَّل: إعادة ترتيب مفاتيح JSON تُغيّر النص
 *     فيفشل توقيع صحيح.
 *  2. **مقارنة ثابتة الزمن**: المقارنة العادية تتوقف عند أول حرف مختلف،
 *     وفرق التوقيت يسرّب التوقيع حرفًا حرفًا.
 *  3. **حداثة الطابع**: بدونها يكفي أن يلتقط أحدهم طلبًا صحيحًا مرة
 *     ليعيد إرساله متى شاء فيُعلَّم طلب مدفوعًا بلا دفع.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  const secret = dpayWebhookSecret();

  if (!secret || !signature || !timestamp) return false;

  const sentAt = Number(timestamp);

  if (!Number.isFinite(sentAt)) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - sentAt);

  if (ageSeconds > MAX_WEBHOOK_AGE_SECONDS) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');

  // `timingSafeEqual` يرمي على اختلاف الطول، والطول ليس سرًّا
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
