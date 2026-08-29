import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createDatabaseAdapter } from '../src/lib/db-adapter.js';
import { hashPassword, passwordIssues } from '../src/lib/password.js';
import { ADMIN_ROLES, type AdminRole } from '../src/lib/constants.js';

/**
 * إنشاء حساب مدير.
 *
 * تفاعلي:      npm run seed:admin
 * غير تفاعلي:  npm run seed:admin -- --email a@b.co --name "الاسم" --role super_admin
 *              (كلمة المرور تُقرأ من متغير البيئة ADMIN_PASSWORD)
 *
 * لا توجد كلمة مرور افتراضية في الكود — ولا يمكن إنشاء حساب بدونها.
 */

const adapter = createDatabaseAdapter(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const interactive = stdin.isTTY && !arg('email');

  let email = arg('email');
  let name = arg('name');
  let role = (arg('role') ?? 'super_admin') as AdminRole;
  let password = process.env.ADMIN_PASSWORD;

  if (interactive) {
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      console.log('\n👤 إنشاء حساب مدير لـ Monebra Perfume\n');
      name = (await rl.question('الاسم الكامل: ')).trim();
      email = (await rl.question('البريد الإلكتروني: ')).trim();

      const roleAnswer = (
        await rl.question(`الدور [${ADMIN_ROLES.join(' / ')}] (super_admin): `)
      ).trim();
      role = (roleAnswer || 'super_admin') as AdminRole;

      password = await rl.question('كلمة المرور: ');
    } finally {
      rl.close();
    }
  }

  // ── التحقق ──
  const errors: string[] = [];

  if (!name) errors.push('الاسم مطلوب');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('البريد الإلكتروني غير صالح');
  }
  if (!ADMIN_ROLES.includes(role)) {
    errors.push(`الدور غير معروف. القيم المتاحة: ${ADMIN_ROLES.join(', ')}`);
  }
  if (!password) {
    errors.push(
      'كلمة المرور مطلوبة (مرّرها عبر متغير البيئة ADMIN_PASSWORD في الوضع غير التفاعلي)',
    );
  } else {
    errors.push(...passwordIssues(password));
  }

  if (errors.length > 0) {
    console.error('\n✗ لا يمكن إنشاء الحساب:');
    for (const error of errors) console.error(`   • ${error}`);
    console.error('');
    process.exit(1);
  }

  const normalizedEmail = email!.toLowerCase();

  const existing = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
  });

  const passwordHash = await hashPassword(password!);

  if (existing) {
    await prisma.adminUser.update({
      where: { id: existing.id },
      data: { name: name!, role, passwordHash, isActive: true },
    });
    console.log(`\n✓ تم تحديث الحساب الموجود: ${normalizedEmail}`);
  } else {
    await prisma.adminUser.create({
      data: { name: name!, email: normalizedEmail, role, passwordHash },
    });
    console.log(`\n✓ تم إنشاء الحساب: ${normalizedEmail}`);
  }

  console.log(`  الدور: ${role}`);
  console.log('  سجّل الدخول من: /admin/login\n');
}

main()
  .catch((error) => {
    console.error('\n✗ خطأ:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
