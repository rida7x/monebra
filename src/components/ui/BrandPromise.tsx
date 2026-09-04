import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * وعد المتجر — العبارة التي تتكرر عبر الموقع لترسخ.
 *
 * ── لماذا صيغتان لا واحدة ─────────────────────────────────────────
 * نفس الكتلة البارزة مكرّرة في كل صفحة تتحوّل من وعد إلى ضجيج: العين
 * تتعوّدها فتتخطّاها، والموقع يبدو كإعلان لا كمتجر. فصيغتان:
 *
 *   `band`   — بارزة بخيطين ذهبيين. لصفحات التصفّح حيث الزائر يقرّر
 *              أين يذهب، ومساحة الرأس متاحة.
 *   `inline` — سطر هادئ بلا خيوط. للمواضع الضيّقة (صفحة المنتج، السلة،
 *              التذييل) حيث الرسالة تذكير لا عنوان.
 *
 * الرقم مفصول عن النص في الحالتين: الجملة بحجم واحد تُقرأ سطرًا عابرًا،
 * والرقم هو الادّعاء فيُعطى وزنًا بصريًا مستقلًا.
 *
 * ⚠️ الأرقام تُعرض لاتينية دائمًا (`90%` لا `٩٠٪`) — المدير يكتب العبارة
 * بأي شكل، والتوحيد مسؤولية الواجهة لا ذاكرته.
 */
export function BrandPromise({
  text,
  variant = 'band',
  className,
}: {
  text: string;
  variant?: 'band' | 'inline';
  className?: string;
}) {
  if (!text.trim()) return null;

  const { before, figure, after } = splitFigure(toLatinDigits(text));

  const sentence = (
    <span className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-center">
      <span
        className={cn(
          'leading-relaxed text-[var(--text-primary)]',
          variant === 'band' ? 'text-[0.9rem] sm:text-base' : 'text-[0.82rem]',
        )}
      >
        {before}
      </span>

      {figure ? (
        <span
          className={cn(
            'tabular text-gold-gradient font-bold leading-none tracking-tight',
            variant === 'band' ? 'text-2xl sm:text-[1.75rem]' : 'text-base',
          )}
        >
          {figure}
        </span>
      ) : null}

      {after ? (
        <span
          className={cn(
            'leading-relaxed text-[var(--text-primary)]',
            variant === 'band' ? 'text-[0.9rem] sm:text-base' : 'text-[0.82rem]',
          )}
        >
          {after}
        </span>
      ) : null}
    </span>
  );

  if (variant === 'inline') {
    return (
      <p
        className={cn(
          'flex items-center justify-center gap-2 text-[var(--text-secondary)]',
          className,
        )}
      >
        <BadgeCheck
          size={15}
          aria-hidden
          className="shrink-0 text-[var(--accent)]"
        />
        {sentence}
      </p>
    );
  }

  return (
    <div
      className={cn('flex items-center justify-center gap-5 sm:gap-7', className)}
    >
      {/* خيطان ذهبيان يحصران العبارة — إطار بلا صندوق */}
      <span className="hidden h-px max-w-[8rem] flex-1 rule-gold sm:block" />

      {/* الأيقونة عنصر مستقل لا جزء من مجرى السطر: داخله كانت تفصل الكلمة
          الأولى عن بقية الجملة وتبدو كأنها تخصّها وحدها */}
      <span className="flex items-center gap-3 sm:gap-3.5">
        <BadgeCheck
          size={19}
          aria-hidden
          className="shrink-0 text-[var(--accent)]"
        />
        {sentence}
      </span>

      <span className="hidden h-px max-w-[8rem] flex-1 rule-gold sm:block" />
    </div>
  );
}

/** يحوّل الأرقام العربية الشرقية (٠١٢…) إلى لاتينية */
function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (digit) =>
    String(digit.charCodeAt(0) - 0x0660),
  );
}

/**
 * يعزل أول رقم في الجملة — مع علامة النسبة إن لحقته.
 *
 * بلا رقم يعود النص كاملًا في `before`، فتعمل أي عبارة يكتبها المدير حتى
 * لو خلت من أرقام.
 */
function splitFigure(text: string): {
  before: string;
  figure: string;
  after: string;
} {
  const match = text.match(/(\d+(?:[.,]\d+)?\s*[%٪]?)/);
  if (!match) return { before: text, figure: '', after: '' };

  const figure = match[1]!.replace('٪', '%').replace(/\s+/g, '');
  const at = match.index!;

  return {
    before: text.slice(0, at).trim(),
    figure,
    after: text.slice(at + match[1]!.length).trim(),
  };
}
