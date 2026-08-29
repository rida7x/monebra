import 'server-only';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/constants';

/**
 * أي طرق الدفع متاحة فعلًا في هذه اللحظة.
 *
 * ── لماذا لا تكفي قائمة `PAYMENT_METHODS` ─────────────────────────
 * القائمة تعدّد ما **يعرفه** المتجر، لا ما يستطيع تحصيله. وطريقة تظهر
 * للزبون بلا بيانات تاجر خلفها هي زرّ وهمي بالتعريف: يضغطه فيقع في مسار
 * لا نهاية له، أو أسوأ — يُنشأ طلب لم يُدفع ثمنه ويُسلَّم.
 *
 * فالإتاحة تُشتقّ من وجود بيانات المزوّد نفسها، لا من راية منفصلة يمكن أن
 * تُرفع سهوًا. لا بيانات ⇒ لا خيار ⇒ لا زرّ.
 *
 * ⚠️ تُقرأ على الخادم دائمًا. لو حُسبت في المتصفح لأمكن للزبون إضافة طريقة
 * غير مفعّلة إلى الطلب، ونحن نتحقق من الاختيار على الخادم عند الإنشاء —
 * فبقاء المصدر واحدًا هو ما يجعل التحقق ذا معنى.
 */

/** المتغيّرات التي لا يعمل المزوّد بدونها. فارغة = غير موصول بعد. */
const REQUIRED_ENV: Record<PaymentMethod, readonly string[]> = {
  // الدفع عند الاستلام لا يحتاج مزوّدًا — متاح دائمًا
  cod: [],
  mobicash: ['MOBICASH_MERCHANT_ID', 'MOBICASH_API_KEY', 'MOBICASH_API_URL'],
  edfali: ['EDFALI_MERCHANT_ID', 'EDFALI_API_KEY', 'EDFALI_API_URL'],
};

/**
 * ⚠️ حتى مع وجود البيانات، تبقى الطريقة معطّلة ما دام الربط لم يُكتب بعد.
 * وجود مفتاح في البيئة لا يعني أن الشيفرة تعرف كيف تُخاطب المصرف؛ ورفع
 * هذه الراية قبل كتابة الربط واختباره يُنتج بالضبط الزرّ الوهمي الذي
 * يمنعه هذا الملف. تُرفع لكل مزوّد في الالتزام الذي يُنجز ربطه.
 */
const IMPLEMENTED: Record<PaymentMethod, boolean> = {
  cod: true,
  mobicash: false,
  edfali: false,
};

export function isPaymentMethodEnabled(method: string): method is PaymentMethod {
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) return false;

  const key = method as PaymentMethod;
  if (!IMPLEMENTED[key]) return false;

  return REQUIRED_ENV[key].every((name) => Boolean(process.env[name]));
}

/** الطرق التي تُعرض للزبون — بالترتيب المعروض */
export function enabledPaymentMethods(): PaymentMethod[] {
  return PAYMENT_METHODS.filter((method) => isPaymentMethodEnabled(method));
}
