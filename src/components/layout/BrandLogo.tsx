import Image from 'next/image';

/**
 * شعار العلامة، متبدّل مع الوضع.
 *
 * النسختان تُرسَلان من الخادم معًا وتخفي CSS واحدة حسب `data-theme` على
 * <html> — انظر `globals.css`. لماذا لا يُختار الشعار في جافاسكربت؟ لأن
 * الخادم لا يعرف وضع الزائر، فأي اختيار وقت الرسم يعني وميض الشعار الخطأ
 * ثم استبداله بعد الترطيب. الإخفاء بالـ CSS يحسم الأمر قبل أول رسم.
 *
 * فارغًا: يُعرض اسم المتجر بالخط الزخرفي — لا مربّع مكسور ولا فراغ.
 */
export function BrandLogo({
  storeName,
  logoUrl,
  logoUrlLight,
  className,
  width = 150,
  height = 40,
  priority = false,
  fallbackClassName,
}: {
  storeName: string;
  logoUrl: string;
  logoUrlLight: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  fallbackClassName?: string;
}) {
  if (!logoUrl && !logoUrlLight) {
    return <span className={fallbackClassName}>{storeName}</span>;
  }

  // نسخة واحدة مرفوعة: تُستخدم في الوضعين بلا إخفاء، فلا يختفي الشعار
  // كليًا في أحدهما
  const single = !logoUrl || !logoUrlLight;

  return (
    <>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={storeName}
          width={width}
          height={height}
          priority={priority}
          data-logo={single ? undefined : 'dark'}
          className={className}
        />
      ) : null}

      {logoUrlLight ? (
        <Image
          src={logoUrlLight}
          alt={single ? storeName : ''}
          // النسخة الثانية تكرار بصري لا معلومة جديدة — إخفاؤها عن قارئ
          // الشاشة يمنع نطق اسم المتجر مرتين متتاليتين
          aria-hidden={single ? undefined : true}
          width={width}
          height={height}
          priority={priority}
          data-logo={single ? undefined : 'light'}
          className={className}
        />
      ) : null}
    </>
  );
}
