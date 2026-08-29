import 'server-only';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/constants';
import { dpayToken, dpayWebhookSecret } from '@/lib/payments/dpay';

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

/**
 * موبي كاش وأدفعلي كلاهما عبر بوّابة DPay الواحدة، فشرطهما واحد.
 *
 * ⚠️ سرّ الـ webhook شرط لا رفاهية: بدونه لا نستطيع التحقق من تأكيد الدفع،
 * وطريقة تُحصّل ولا نتحقق من تأكيدها أسوأ من طريقة معطّلة.
 */
function dpayReady(): boolean {
  return Boolean(dpayToken() && dpayWebhookSecret());
}

const AVAILABILITY: Record<PaymentMethod, () => boolean> = {
  // الدفع عند الاستلام لا يحتاج مزوّدًا — متاح دائمًا
  cod: () => true,
  mobicash: dpayReady,
  edfali: dpayReady,
};

export function isPaymentMethodEnabled(method: string): method is PaymentMethod {
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) return false;

  return AVAILABILITY[method as PaymentMethod]();
}

/** الطرق التي تُعرض للزبون — بالترتيب المعروض */
export function enabledPaymentMethods(): PaymentMethod[] {
  return PAYMENT_METHODS.filter((method) => isPaymentMethodEnabled(method));
}
