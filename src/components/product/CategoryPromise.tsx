import { BadgeCheck } from 'lucide-react';

/**
 * شريط وعد المطابقة أعلى صفحات الأقسام.
 *
 * ── لماذا يُفصل الرقم عن النص ──────────────────────────────────────
 * الجملة كلها بحجم واحد تُقرأ كسطر عابر. الرقم هو الادّعاء، فيُعطى وزنًا
 * بصريًا مستقلًا: حجم أكبر، ووزن أثقل، وتدرّج ذهبي — فتلتقطه العين قبل
 * قراءة الجملة. والباقي يبقى هادئًا، وإلا صار الشريط صراخًا.
 *
 * ⚠️ الأرقام تُعرض لاتينية دائمًا (`90%` لا `٩٠٪`). العربية الشرقية تبدو
 * أصيلة لكن أضيق قراءةً في الأرقام الترويجية، ويكتبها المدير بأي شكل —
 * فنوحّدها هنا بدل الاعتماد على ما كُتب في الإعدادات.
 */
export function CategoryPromise({ text }: { text: string }) {
  if (!text.trim()) return null;

  const { before, figure, after } = splitFigure(toLatinDigits(text));

  return (
    <div
      className="mb-9 flex items-center justify-center gap-5 sm:gap-7"
      style={{ fontFamily: 'var(--font-cairo)' }}
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

        <span className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-center">
          <span className="text-[0.9rem] leading-relaxed text-[var(--text-primary)] sm:text-base">
            {before}
          </span>

          {figure ? (
            <span className="tabular text-gold-gradient text-2xl font-bold leading-none tracking-tight sm:text-[1.75rem]">
              {figure}
            </span>
          ) : null}

          {after ? (
            <span className="text-[0.9rem] leading-relaxed text-[var(--text-primary)] sm:text-base">
              {after}
            </span>
          ) : null}
        </span>
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
