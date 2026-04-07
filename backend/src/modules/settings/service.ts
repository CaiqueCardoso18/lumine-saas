import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { AppError, NotFoundError } from '../../shared/errors/AppError';

type SettingValue = string | number | boolean | object;

export async function getAllSettings() {
  const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  return settings.reduce<Record<string, SettingValue>>((acc, s) => {
    acc[s.key] = s.value as SettingValue;
    return acc;
  }, {});
}

export async function updateSettings(updates: Record<string, SettingValue>) {
  const operations = Object.entries(updates).map(([key, value]) =>
    prisma.setting.upsert({
      where: { key },
      update: { value: value as Parameters<typeof prisma.setting.upsert>[0]['update']['value'] },
      create: { key, value: value as Parameters<typeof prisma.setting.create>[0]['data']['value'] },
    })
  );

  await Promise.all(operations);
  return getAllSettings();
}

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      subcategories: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { products: true } },
    },
  });
}

export async function createCategory(data: { name: string; slug: string; icon?: string; sortOrder?: number }) {
  return prisma.category.create({ data });
}

export async function updateCategory(id: string, data: Partial<{ name: string; icon: string; sortOrder: number }>) {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw new NotFoundError('Categoria');
  return prisma.category.update({ where: { id }, data });
}

export async function createSubcategory(data: { name: string; slug: string; categoryId: string; sortOrder?: number }) {
  const cat = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!cat) throw new NotFoundError('Categoria');
  return prisma.subcategory.create({ data });
}

export async function listUsers() {
  return prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, active: true, permissions: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: 'OWNER' | 'EMPLOYEE';
  permissions: string[];
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError('E-mail já cadastrado', 400);

  const passwordHash = await bcrypt.hash(data.password, 10);
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      permissions: data.permissions,
    },
    select: { id: true, email: true, name: true, role: true, active: true, permissions: true, createdAt: true },
  });
}

export async function toggleUserActive(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Usuário');
  return prisma.user.update({
    where: { id },
    data: { active: !user.active },
    select: { id: true, email: true, name: true, role: true, active: true, permissions: true },
  });
}

export async function updateUserPermissions(id: string, permissions: string[]) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('Usuário');
  return prisma.user.update({
    where: { id },
    data: { permissions },
    select: { id: true, email: true, name: true, role: true, active: true, permissions: true },
  });
}

export async function listSuppliers() {
  return prisma.supplier.findMany({ orderBy: { name: 'asc' } });
}

export async function createSupplier(data: {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}) {
  return prisma.supplier.create({ data });
}

export async function updateSupplier(id: string, data: Partial<{
  name: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
}>) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw new NotFoundError('Fornecedor');
  return prisma.supplier.update({ where: { id }, data });
}

export async function deleteSupplier(id: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw new NotFoundError('Fornecedor');
  await prisma.supplier.delete({ where: { id } });
}
