'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Layers,
  Users,
  MapPin,
  Tags,
  BadgePercent,
  Star,
  BarChart3,
  Settings,
  FileText,
  ScrollText,
  Menu,
  X,
  LogOut,
  Store,
  Bell,
} from 'lucide-react';
import type { Permission } from '@/lib/constants';
import { ADMIN_ROLE_LABELS, type AdminRole } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * هيكل لوحة التحكم: شريط جانبي + رأس.
 *
 * الشريط الجانبي يُبنى من صلاحيات المستخدم الفعلية: من لا يملك
 * `products.manage` لا يرى رابط المنتجات أصلًا. هذا تحسين للتجربة لا
 * حماية — الحماية الحقيقية في `requireAdmin(permission)` داخل كل صفحة
 * وكل نقطة نهاية، فحتى لو كتب الرابط يدويًا يُمنع.
 */

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
  exact?: boolean;
  /**
   * قسم لم يُبنَ بعد لا يظهر في الشريط — حتى لا يقود المستخدم إلى صفحة
   * غير موجودة. كل الأقسام مبنية حاليًا، والعلم باقٍ لما يُضاف مستقبلًا.
   */
  ready?: boolean;
};

type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: 'الرئيسية',
    items: [
      {
        href: '/admin',
        label: 'لوحة المعلومات',
        icon: LayoutDashboard,
        permission: 'dashboard.view',
        exact: true,
      },
      {
        href: '/admin/orders',
        label: 'الطلبات',
        icon: ShoppingCart,
        permission: 'orders.view',
      },
    ],
  },
  {
    title: 'الكتالوج',
    items: [
      {
        href: '/admin/products',
        label: 'المنتجات',
        icon: Package,
        permission: 'products.view',
      },
      {
        href: '/admin/categories',
        label: 'التصنيفات',
        icon: Tags,
        permission: 'categories.manage',
      },
      {
        href: '/admin/bundles',
        label: 'الباقات',
        icon: Layers,
        permission: 'products.view',
      },
      {
        href: '/admin/inventory',
        label: 'المخزون',
        icon: Boxes,
        permission: 'inventory.view',
      },
    ],
  },
  {
    title: 'المبيعات',
    items: [
      {
        href: '/admin/customers',
        label: 'العملاء',
        icon: Users,
        permission: 'customers.view',
      },
      {
        href: '/admin/cities',
        label: 'المدن والتوصيل',
        icon: MapPin,
        permission: 'cities.manage',
      },
      {
        href: '/admin/coupons',
        label: 'الكوبونات',
        icon: BadgePercent,
        permission: 'coupons.manage',
      },
      {
        href: '/admin/reviews',
        label: 'التقييمات',
        icon: Star,
        permission: 'reviews.manage',
      },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      {
        href: '/admin/analytics',
        label: 'التحليلات',
        icon: BarChart3,
        permission: 'analytics.view',
      },
      {
        href: '/admin/content',
        label: 'المحتوى',
        icon: FileText,
        permission: 'content.manage',
      },
      {
        href: '/admin/settings',
        label: 'الإعدادات',
        icon: Settings,
        permission: 'settings.manage',
      },
      {
        href: '/admin/users',
        label: 'المستخدمون',
        icon: Users,
        permission: 'users.manage',
      },
      {
        href: '/admin/logs',
        label: 'سجل الأخطاء',
        icon: ScrollText,
        permission: 'logs.view',
      },
    ],
  },
];

export function AdminShell({
  user,
  storeName,
  unreadCount,
  children,
}: {
  user: { name: string; email: string; role: string; permissions: string[] };
  storeName: string;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const allowed = new Set(user.permissions);

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.ready !== false && allowed.has(item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  const current = groups
    .flatMap((group) => group.items)
    .find((item) =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href),
    );

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/admin/auth/logout', { method: 'POST' }).catch(
      () => undefined,
    );
    router.replace('/admin/login');
    router.refresh();
  }

  const sidebar = (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-[var(--surface-border)] px-5">
        <Link
          href="/admin"
          className="font-display text-lg tracking-wide text-[var(--accent)]"
        >
          {storeName}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="قوائم اللوحة">
        {groups.map((group) => (
          <div key={group.title} className="mb-5">
            <p className="mb-2 px-3 text-[0.65rem] font-semibold tracking-wider text-[var(--text-muted)]">
              {group.title}
            </p>

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                        active
                          ? 'bg-[var(--accent)]/12 font-semibold text-[var(--accent)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
                      )}
                    >
                      <Icon size={17} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--surface-border)] p-3">
        <Link
          href="/"
          target="_blank"
          className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
        >
          <Store size={17} aria-hidden />
          عرض المتجر
        </Link>

        <div className="mt-2 rounded-lg bg-[var(--surface-sunken)] p-3">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {ADMIN_ROLE_LABELS[user.role as AdminRole] ?? user.role}
          </p>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--surface-border)] py-2 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-50"
          >
            <LogOut size={13} aria-hidden />
            {loggingOut ? 'جارٍ الخروج…' : 'تسجيل الخروج'}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh">
      {/* ── الشريط الجانبي على الشاشات الكبيرة ── */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-[var(--surface-border)] bg-[var(--surface-raised)] lg:flex">
        {sidebar}
      </aside>

      {/* ── الدرج على الهاتف ── */}
      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="قائمة اللوحة"
          >
            <button
              type="button"
              aria-label="إغلاق القائمة"
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 h-full w-full cursor-default bg-black/50"
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 end-0 flex w-72 flex-col bg-[var(--surface-raised)] shadow-[var(--shadow-deep)]"
            >
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="إغلاق"
                className="tap-target absolute end-2 top-2 z-10 flex items-center justify-center rounded-full text-[var(--text-secondary)]"
              >
                <X size={20} aria-hidden />
              </button>
              {sidebar}
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── المحتوى ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-[var(--surface-border)] bg-[var(--surface-raised)]/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="فتح القائمة"
              className="tap-target -ms-2 flex items-center justify-center rounded-lg lg:hidden"
            >
              <Menu size={21} aria-hidden />
            </button>

            <h1 className="text-base font-semibold sm:text-lg">
              {current?.label ?? 'لوحة التحكم'}
            </h1>
          </div>

          {allowed.has('orders.view') ? (
            <Link
              href="/admin/orders?status=new"
              className="tap-target relative flex items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
              aria-label={
                unreadCount > 0
                  ? `${unreadCount} إشعار غير مقروء`
                  : 'الإشعارات'
              }
            >
              <Bell size={19} aria-hidden />
              {unreadCount > 0 ? (
                <span className="tabular absolute -top-0.5 end-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[0.6rem] font-bold leading-none text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </Link>
          ) : null}
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
