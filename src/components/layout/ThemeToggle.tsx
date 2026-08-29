'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_THEME,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  isTheme,
  type Theme,
} from '@/lib/theme';

/**
 * زر تبديل الوضع الليلي/النهاري.
 *
 * مصدر الحقيقة هو `<html data-theme>` — كتبه سكربت الرأس قبل أول رسم. لا
 * ننسخه إلى `useState`: نسختان لنفس القيمة تفترقان عاجلًا (تبديل من لسان
 * آخر، أو رجوع للخلف في المتصفح). بدلها `useSyncExternalStore` يقرأ من
 * الـ DOM مباشرة ويعيد الرسم عند تغيّره.
 *
 * الخادم لا يعرف ما في localStorage، فيرسم الافتراضي دائمًا ثم يصحّح
 * React بعد الترطيب — وهو ما يتوقّعه هذا الخطّاف تحديدًا.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    readTheme,
    () => DEFAULT_THEME,
  );

  const toLight = theme === 'dark';

  const toggle = () => {
    const next: Theme = toLight ? 'light' : 'dark';
    const root = document.documentElement;

    // الانتقال مفعّل لحظة التبديل فقط، ومُلغى لمن طلب تقليل الحركة
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-switching');
      window.setTimeout(() => root.classList.remove('theme-switching'), 260);
    }

    // تغيير السمة وحده يكفي لإعادة الرسم — المراقب في `subscribeToTheme`
    // يلتقطه
    root.dataset.theme = next;

    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[next]);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // التصفح الخاص قد يمنع الكتابة — الوضع يعمل، لكنه لا يُحفظ
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        toLight ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'
      }
      title={toLight ? 'الوضع النهاري' : 'الوضع الليلي'}
      className={cn(
        'tap-target flex items-center justify-center rounded-full text-[var(--text-primary)] transition-colors hover:text-[var(--accent)]',
        className,
      )}
    >
      {/* الأيقونتان متراكبتان وتتبادلان الدوران والشفافية — أنعم من استبدال
          عنصر بآخر، ويمنع قفزة العرض بين رمزين مختلفي القياس */}
      <span className="relative block h-5 w-5">
        <Sun
          size={20}
          aria-hidden
          className={cn(
            'absolute inset-0 transition-all duration-300',
            toLight
              ? 'rotate-0 scale-100 opacity-100'
              : 'rotate-90 scale-50 opacity-0',
          )}
        />
        <Moon
          size={20}
          aria-hidden
          className={cn(
            'absolute inset-0 transition-all duration-300',
            toLight
              ? '-rotate-90 scale-50 opacity-0'
              : 'rotate-0 scale-100 opacity-100',
          )}
        />
      </span>
    </button>
  );
}

function readTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return isTheme(value) ? value : DEFAULT_THEME;
}

/** مستمع واحد مشترك لكل زر تبديل في الصفحة (الرأس ودرج الهاتف) */
function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // تبديل من لسان آخر مفتوح على نفس المتجر: نكتب السمة هنا فيلتقطها
  // المراقب أعلاه ويعيد الرسم — فلا يتناقض اللسانان
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY || !isTheme(event.newValue)) return;
    document.documentElement.dataset.theme = event.newValue;
  };

  window.addEventListener('storage', onStorage);

  return () => {
    observer.disconnect();
    window.removeEventListener('storage', onStorage);
  };
}
