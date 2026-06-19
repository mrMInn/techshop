import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Create postgres connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function main() {
  console.log('🚀 Starting seed data generation...');

  try {
    // 1. Create Brands
    console.log('📦 Seeding brands...');
    const brands = await db.insert(schema.brands).values([
      { name: 'Apple', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg' },
      { name: 'Dell', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/48/Dell_Logo.svg' },
      { name: 'Asus', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/ASUS_Logo.svg' },
      { name: 'Lenovo', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Lenovo_logo_2015.svg' },
    ]).returning();
    const appleId = brands.find(b => b.name === 'Apple')!.id;

    // 2. Create Categories
    console.log('📁 Seeding categories...');
    const [laptopCat] = await db.insert(schema.categories).values({
      name: 'Laptop',
      slug: 'laptop',
      description: 'Máy tính xách tay các loại'
    }).returning();

    const macbookCat = await db.insert(schema.categories).values([
      { name: 'MacBook Air', slug: 'macbook-air', parentId: laptopCat.id, description: 'Apple MacBook Air' },
      { name: 'MacBook Pro', slug: 'macbook-pro', parentId: laptopCat.id, description: 'Apple MacBook Pro' },
    ]).returning();

    const macbookAirId = macbookCat.find(c => c.name === 'MacBook Air')!.id;
    const macbookProId = macbookCat.find(c => c.name === 'MacBook Pro')!.id;

    // 3. Create Products
    console.log('💻 Seeding products...');
    await db.insert(schema.products).values([
      {
        name: 'MacBook Air 13-inch M3',
        slug: 'macbook-air-13-m3',
        sku: 'MBA13-M3',
        categoryId: macbookAirId,
        brandId: appleId,
        description: 'MacBook Air 13 inch với chip Apple M3, thiết kế siêu mỏng nhẹ.',
        specs: {
          cpu: 'Apple M3 8-core CPU',
          gpu: '8-core GPU',
          ram: '8GB Unified Memory',
          ssd: '256GB SSD',
          screen: '13.6-inch Liquid Retina display',
          color: 'Midnight'
        },
        warrantyMonths: 12,
        isActive: true
      },
      {
        name: 'MacBook Pro 14-inch M3 Pro',
        slug: 'macbook-pro-14-m3-pro',
        sku: 'MBP14-M3-PRO',
        categoryId: macbookProId,
        brandId: appleId,
        description: 'MacBook Pro 14 inch với chip Apple M3 Pro, sức mạnh đồ hoạ vượt trội.',
        specs: {
          cpu: 'Apple M3 Pro 11-core CPU',
          gpu: '14-core GPU',
          ram: '18GB Unified Memory',
          ssd: '512GB SSD',
          screen: '14.2-inch Liquid Retina XDR display',
          color: 'Space Black'
        },
        warrantyMonths: 12,
        isActive: true
      },
      {
        name: 'MacBook Pro 16-inch M3 Max',
        slug: 'macbook-pro-16-m3-max',
        sku: 'MBP16-M3-MAX',
        categoryId: macbookProId,
        brandId: appleId,
        description: 'MacBook Pro 16 inch với chip Apple M3 Max mạnh nhất.',
        specs: {
          cpu: 'Apple M3 Max 14-core CPU',
          gpu: '30-core GPU',
          ram: '36GB Unified Memory',
          ssd: '1TB SSD',
          screen: '16.2-inch Liquid Retina XDR display',
          color: 'Space Black'
        },
        warrantyMonths: 12,
        isActive: true
      }
    ]);

    console.log('✅ Seed data successfully inserted!');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    process.exit(0);
  }
}

main();
