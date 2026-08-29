/**
 * تخطيط لوحة التحكم.
 *
 * `data-surface="admin"` يبدّل الأسطح إلى اللوحة الفاتحة — أنسب للعمل
 * الطويل على الجداول والنماذج من الوضع الداكن السينمائي للمتجر. كل مكوّن
 * يقرأ ألوانه من المتغيرات فيعمل في السياقين بلا تعديل.
 *
 * ⚠️ التقسيم إلى مجموعتين مقصود:
 *   (auth)/admin/login       ← بلا حارس، وإلا لدارت إعادة التوجيه بلا نهاية
 *   (dashboard)/admin/**     ← تخطيطها يتحقق من الجلسة ويعرض الشريط الجانبي
 * المجموعتان لا تظهران في الرابط، فالمسارات تبقى /admin/login و /admin.
 */
export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      data-surface="admin"
      className="min-h-dvh bg-[var(--surface-base)] text-[var(--text-primary)]"
    >
      {children}
    </div>
  );
}
