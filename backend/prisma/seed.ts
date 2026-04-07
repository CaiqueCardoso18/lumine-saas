import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const categories = [
  { name: 'Collants', slug: 'collants', icon: '🩱', sortOrder: 1 },
  { name: 'Sapatilhas', slug: 'sapatilhas', icon: '👟', sortOrder: 2 },
  { name: 'Meias e Acessórios para Pés', slug: 'meias-e-acessorios', icon: '🧦', sortOrder: 3 },
  { name: 'Saias e Tutus', slug: 'saias-e-tutus', icon: '👗', sortOrder: 4 },
  { name: 'Shorts e Leggings', slug: 'shorts-e-leggings', icon: '🩲', sortOrder: 5 },
  { name: 'Tops e Bodys', slug: 'tops-e-bodys', icon: '👙', sortOrder: 6 },
  { name: 'Aquecedores e Agasalhos', slug: 'aquecedores-e-agasalhos', icon: '🧥', sortOrder: 7 },
  { name: 'Acessórios', slug: 'acessorios', icon: '💎', sortOrder: 8 },
  { name: 'Figurinos', slug: 'figurinos', icon: '🎭', sortOrder: 9 },
  { name: 'Bolsas e Mochilas', slug: 'bolsas-e-mochilas', icon: '👜', sortOrder: 10 },
  { name: 'Calçados', slug: 'calcados', icon: '👠', sortOrder: 11 },
];

const subcategories: Record<string, { name: string; slug: string }[]> = {
  sapatilhas: [
    { name: 'Ballet', slug: 'ballet' },
    { name: 'Jazz', slug: 'jazz' },
    { name: 'Contemporâneo', slug: 'contemporaneo' },
    { name: 'Sapato de Dança', slug: 'sapato-de-danca' },
  ],
  calcados: [
    { name: 'Pontas', slug: 'pontas' },
    { name: 'Meia-ponta', slug: 'meia-ponta' },
    { name: 'Jazz Shoes', slug: 'jazz-shoes' },
    { name: 'Sapato Latino', slug: 'sapato-latino' },
  ],
  acessorios: [
    { name: 'Faixas e Tiaras', slug: 'faixas-e-tiaras' },
    { name: 'Elásticos', slug: 'elasticos' },
    { name: 'Meia Calça', slug: 'meia-calca' },
  ],
};

const defaultSettings = [
  { key: 'store_name', value: 'Lumine' },
  { key: 'store_email', value: 'contato@lumine.com.br' },
  { key: 'store_phone', value: '' },
  { key: 'store_address', value: '' },
  { key: 'store_logo_url', value: '' },
  { key: 'default_min_stock', value: 5 },
  { key: 'currency', value: 'BRL' },
  { key: 'timezone', value: 'America/Sao_Paulo' },
];

async function main() {
  console.log('🌱 Iniciando seed...');

  // Criar categorias
  for (const cat of categories) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });

    // Criar subcategorias se existirem
    const subs = subcategories[cat.slug];
    if (subs) {
      for (const sub of subs) {
        await prisma.subcategory.upsert({
          where: { categoryId_slug: { categoryId: category.id, slug: sub.slug } },
          update: {},
          create: { ...sub, categoryId: category.id },
        });
      }
    }
  }
  console.log(`✅ ${categories.length} categorias criadas`);

  // Criar configurações padrão
  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: { key: setting.key, value: setting.value },
    });
  }
  console.log(`✅ ${defaultSettings.length} configurações criadas`);

  // Criar usuário OWNER padrão
  const ownerExists = await prisma.user.findUnique({ where: { email: 'admin@lumine.com.br' } });
  if (!ownerExists) {
    const passwordHash = await bcrypt.hash('Lumine@2024!', 12);
    await prisma.user.create({
      data: {
        email: 'admin@lumine.com.br',
        passwordHash,
        name: 'Administrador Lumine',
        role: 'OWNER',
      },
    });
    console.log('✅ Usuário admin criado: admin@lumine.com.br / Lumine@2024!');
  }

  console.log('🎉 Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
