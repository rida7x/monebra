import {
  Sparkles,
  Flower2,
  Leaf,
  Citrus,
  Droplet,
  Flame,
  Sun,
  Moon,
  Snowflake,
  Wind,
  TreePine,
  Crown,
  Gem,
  Heart,
  Star,
  Package,
} from 'lucide-react';
import { isCategoryIcon, type CategoryIconKey } from '@/lib/constants';

/**
 * أيقونة التصنيف.
 *
 * الربط صريح لا ديناميكي: `lucide-react` يصدّر أكثر من ألف أيقونة، واختيارها
 * باسم متغيّر يمنع الحزم من إسقاط غير المستخدم فتُشحن كلها. الجدول هنا
 * يجعل ما يصل المتصفح ستة عشر رسمًا لا أكثر.
 *
 * التصنيف بلا أيقونة يرجع إلى `Sparkles` — أفضل من فراغ يكسر اصطفاف
 * البطاقات في الشبكة.
 */
const ICONS: Record<CategoryIconKey, typeof Sparkles> = {
  sparkles: Sparkles,
  flower: Flower2,
  leaf: Leaf,
  citrus: Citrus,
  droplet: Droplet,
  flame: Flame,
  sun: Sun,
  moon: Moon,
  snowflake: Snowflake,
  wind: Wind,
  tree: TreePine,
  crown: Crown,
  gem: Gem,
  heart: Heart,
  star: Star,
  package: Package,
};

export function CategoryIcon({
  icon,
  size = 22,
  className,
}: {
  icon: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const Component = isCategoryIcon(icon) ? ICONS[icon] : Sparkles;
  return <Component size={size} className={className} aria-hidden />;
}
