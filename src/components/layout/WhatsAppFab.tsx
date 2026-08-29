import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '@/lib/settings';

/**
 * زر واتساب العائم.
 *
 * يُرفع فوق شريط التنقل السفلي على الهاتف حتى لا يتداخل معه. لا يُعرض
 * إطلاقًا إذا لم يُدخل المدير رقم واتساب — لا زر بلا وظيفة.
 */
export function WhatsAppFab({
  number,
  storeName,
}: {
  number: string;
  storeName: string;
}) {
  const href = whatsappLink(
    number,
    `مرحبًا ${storeName}، أريد الاستفسار عن العطور المتوفرة.`,
  );

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا عبر واتساب"
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] end-4 z-[55] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[var(--shadow-deep)] transition-transform duration-300 ease-[var(--ease-luxe)] hover:scale-105 active:scale-95 lg:bottom-6 lg:end-6"
    >
      <MessageCircle size={24} aria-hidden />
    </a>
  );
}
