import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '../src/generated/prisma/client';
import { resolveDatabaseUrl } from '../src/infrastructure/prisma/database-url';

const BCRYPT_SALT_ROUNDS = 12;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: resolveDatabaseUrl() }),
});

interface SeedCategory {
  name: string;
  slug: string;
}

interface SeedProduct {
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  categorySlug: string;
}

const categories: SeedCategory[] = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Apparel', slug: 'apparel' },
  { name: 'Home & Kitchen', slug: 'home-kitchen' },
];

const products: SeedProduct[] = [
  {
    name: 'Wireless Bluetooth Headphones',
    slug: 'wireless-bluetooth-headphones',
    description: 'Over-ear headphones with active noise cancellation and 30-hour battery life.',
    priceCents: 12999,
    categorySlug: 'electronics',
  },
  {
    name: 'Smart Fitness Watch',
    slug: 'smart-fitness-watch',
    description: 'Water-resistant fitness watch with heart-rate monitoring and GPS tracking.',
    priceCents: 19999,
    categorySlug: 'electronics',
  },
  {
    name: 'Portable Bluetooth Speaker',
    slug: 'portable-bluetooth-speaker',
    description: 'Compact speaker with 12-hour battery life and IPX7 waterproof rating.',
    priceCents: 5999,
    categorySlug: 'electronics',
  },
  {
    name: 'USB-C Charging Hub',
    slug: 'usb-c-charging-hub',
    description: '7-in-1 USB-C hub with HDMI, USB 3.0 ports, and 100W power delivery.',
    priceCents: 3499,
    categorySlug: 'electronics',
  },
  {
    name: 'Classic Cotton T-Shirt',
    slug: 'classic-cotton-t-shirt',
    description: 'Soft 100% cotton crew-neck t-shirt in a classic everyday fit.',
    priceCents: 1999,
    categorySlug: 'apparel',
  },
  {
    name: 'Slim Fit Denim Jeans',
    slug: 'slim-fit-denim-jeans',
    description: 'Stretch denim jeans with a modern slim fit and five-pocket styling.',
    priceCents: 4999,
    categorySlug: 'apparel',
  },
  {
    name: 'Hooded Fleece Sweatshirt',
    slug: 'hooded-fleece-sweatshirt',
    description: 'Midweight fleece hoodie with kangaroo pocket and adjustable drawstring.',
    priceCents: 3999,
    categorySlug: 'apparel',
  },
  {
    name: 'Canvas Low-Top Sneakers',
    slug: 'canvas-low-top-sneakers',
    description: 'Casual canvas sneakers with a rubber outsole and cushioned insole.',
    priceCents: 5499,
    categorySlug: 'apparel',
  },
  {
    name: 'Stainless Steel French Press',
    slug: 'stainless-steel-french-press',
    description: '34 oz double-wall stainless steel french press that keeps coffee hot longer.',
    priceCents: 2999,
    categorySlug: 'home-kitchen',
  },
  {
    name: 'Ceramic Pour-Over Coffee Set',
    slug: 'ceramic-pour-over-coffee-set',
    description: 'Hand-glazed ceramic dripper with matching carafe and reusable filter.',
    priceCents: 4499,
    categorySlug: 'home-kitchen',
  },
  {
    name: 'Bamboo Cutting Board Set',
    slug: 'bamboo-cutting-board-set',
    description: 'Three-piece bamboo cutting board set with juice grooves.',
    priceCents: 2499,
    categorySlug: 'home-kitchen',
  },
  {
    name: '10-Inch Cast Iron Skillet',
    slug: '10-inch-cast-iron-skillet',
    description: 'Pre-seasoned cast iron skillet ready for stovetop, oven, and grill.',
    priceCents: 3999,
    categorySlug: 'home-kitchen',
  },
];

function placeholderImage(name: string): string {
  return `https://placehold.co/600x400?text=${encodeURIComponent(name)}`;
}

async function seedAdminUser(): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? 'admin@miniecommerce.dev';
  const password = process.env.ADMIN_PASSWORD ?? 'admin-change-me';
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: 'Store Admin',
      role: UserRole.ADMIN,
    },
  });
  console.log(`Admin user ensured: ${email}`);
}

async function seedCatalog(): Promise<void> {
  const categoryIdsBySlug = new Map<string, string>();

  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
    categoryIdsBySlug.set(record.slug, record.id);
  }
  console.log(`Categories ensured: ${categories.length}`);

  for (const product of products) {
    const categoryId = categoryIdsBySlug.get(product.categorySlug);
    if (!categoryId) {
      throw new Error(`Unknown category slug: ${product.categorySlug}`);
    }

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        priceCents: product.priceCents,
        imageUrl: placeholderImage(product.name),
        categoryId,
      },
    });
  }
  console.log(`Products ensured: ${products.length}`);
}

async function main(): Promise<void> {
  await seedAdminUser();
  await seedCatalog();
  console.log('Seed completed.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
