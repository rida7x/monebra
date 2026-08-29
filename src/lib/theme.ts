/**
 * الوضع الليلي والنهاري.
 *
 * الداكن هو هوية العلامة والافتراضي، والفاتح اختيار صريح من الزائر يحفظه
 * المتصفح. لا نتبع `prefers-color-scheme` تلقائيًا: أغلب الهواتف تأتي على
 * الوضع الفاتح، فلو تبعناه لرأى معظم الزوار المتجر بمظهر ليس مظهره.
 */

export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'dark';
export const THEME_STORAGE_KEY = 'monebra-theme';

/** لون شريط المتصفح على الهاتف — يطابق `--surface-base` في كل وضع */
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#08080a',
  light: '#fdfcf9',
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * سكربت يُحقن في <head> ويُنفَّذ **قبل أول رسم**.
 *
 * بدونه تُرسم الصفحة بالوضع الداكن (الافتراضي على `:root`) ثم تقفز إلى
 * الفاتح بعد ترطيب React — وميض أبيض مزعج على كل تنقل. لذلك هو سكربت
 * متزامن صغير في <head> لا مكوّن React.
 *
 * `try/catch` ضروري: قراءة localStorage ترمي استثناءً في وضع التصفح
 * الخاص ببعض المتصفحات، وسقوطه هنا يوقف الصفحة كلها.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(t!=="light"&&t!=="dark")t=${JSON.stringify(DEFAULT_THEME)};
document.documentElement.dataset.theme=t;
var m=document.querySelector('meta[name="theme-color"]');
if(m)m.setAttribute("content",t==="light"?${JSON.stringify(THEME_COLORS.light)}:${JSON.stringify(THEME_COLORS.dark)});
}catch(e){document.documentElement.dataset.theme=${JSON.stringify(DEFAULT_THEME)};}})();`;
