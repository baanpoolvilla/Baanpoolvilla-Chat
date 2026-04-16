import { PrismaClient, AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const existingAdmin = await prisma.admin.findUnique({
    where: { email: 'admin@chat.local' },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin1234!', 12);
    const admin = await prisma.admin.create({
      data: {
        email: 'admin@chat.local',
        passwordHash,
        name: 'Super Admin',
        role: AdminRole.SUPER_ADMIN,
      },
    });
    console.log(`✅ Created default admin: ${admin.email}`);
  } else {
    console.log('ℹ️  Default admin already exists');
  }

  const defaultCategories = [
    { name: 'Status', color: '#22c55e' },
    { name: 'Priority', color: '#ef4444' },
    { name: 'Department', color: '#3b82f6' },
  ];

  for (const cat of defaultCategories) {
    await prisma.tagCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log('✅ Created default tag categories');

  const statusCategory = await prisma.tagCategory.findUnique({
    where: { name: 'Status' },
  });

  if (statusCategory) {
    const defaultTags = [
      { name: 'New Customer', color: '#22c55e', categoryId: statusCategory.id },
      { name: 'VIP', color: '#f59e0b', categoryId: statusCategory.id },
      { name: 'Follow Up', color: '#8b5cf6', categoryId: statusCategory.id },
    ];

    for (const tag of defaultTags) {
      await prisma.tag.upsert({
        where: {
          name_categoryId: { name: tag.name, categoryId: tag.categoryId },
        },
        update: {},
        create: tag,
      });
    }
    console.log('✅ Created default tags');
  }

  console.log('🎉 Seed completed');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
