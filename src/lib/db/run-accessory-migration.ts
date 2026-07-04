import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in .env.local');
  process.exit(1);
}

async function main() {
  console.log('🔄 STARTING ACCESSORY SCHEMA MIGRATION...');
  const client = postgres(connectionString!, { max: 1 });

  try {
    // 1. Drop constraints and dependencies if they exist
    console.log('1. Cleaning up existing accessory-related tables if they exist...');
    await client`DROP TABLE IF EXISTS accessory_items CASCADE;`;
    await client`DROP TABLE IF EXISTS accessory_catalog CASCADE;`;
    await client`DROP TYPE IF EXISTS accessory_item_status CASCADE;`;

    // 2. Create the enum
    console.log('2. Creating accessory_item_status enum...');
    await client`CREATE TYPE accessory_item_status AS ENUM ('in_stock', 'attached', 'sold', 'defective', 'returned');`;

    // 3. Create accessory_catalog table
    console.log('3. Creating accessory_catalog table...');
    await client`
      CREATE TABLE accessory_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL UNIQUE,
        default_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
        default_selling_price DECIMAL(15,2) NOT NULL DEFAULT 0,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    // 4. Create accessory_items table
    console.log('4. Creating accessory_items table...');
    await client`
      CREATE TABLE accessory_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        accessory_catalog_id UUID NOT NULL REFERENCES accessory_catalog(id) ON DELETE CASCADE,
        serial_number VARCHAR(100),
        unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
        status accessory_item_status NOT NULL DEFAULT 'in_stock',
        inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
        selling_price DECIMAL(15,2) NOT NULL DEFAULT 0,
        supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
        purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
        batch_code VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    console.log('Creating indexes on accessory_items...');
    await client`CREATE INDEX idx_acc_items_catalog ON accessory_items(accessory_catalog_id);`;
    await client`CREATE INDEX idx_acc_items_status ON accessory_items(status);`;
    await client`CREATE INDEX idx_acc_items_inv ON accessory_items(inventory_item_id);`;

    // 5. Clean up inventory_items table
    console.log('5. Dropping old accessory columns from inventory_items...');
    await client`ALTER TABLE inventory_items DROP COLUMN IF EXISTS accessory_cost;`;
    await client`ALTER TABLE inventory_items DROP COLUMN IF EXISTS accessory_notes;`;

    // 6. Clean up purchase_orders table
    console.log('6. Dropping tax_import from purchase_orders...');
    await client`ALTER TABLE purchase_orders DROP COLUMN IF EXISTS tax_import;`;

    // 7. Alter order_items table
    console.log('7. Modifying order_items table structure...');
    
    // Check if column accessory_item_id exists, drop it if it does before re-adding
    await client`ALTER TABLE order_items DROP COLUMN IF EXISTS accessory_item_id;`;
    await client`ALTER TABLE order_items ADD COLUMN accessory_item_id UUID REFERENCES accessory_items(id) ON DELETE SET NULL;`;

    // Check if column is_gift exists, drop if exists, then add
    await client`ALTER TABLE order_items DROP COLUMN IF EXISTS is_gift;`;
    await client`ALTER TABLE order_items ADD COLUMN is_gift BOOLEAN NOT NULL DEFAULT FALSE;`;

    // Make inventory_item_id nullable
    await client`ALTER TABLE order_items ALTER COLUMN inventory_item_id DROP NOT NULL;`;

    // 8. Seed default accessory catalog
    console.log('8. Seeding default accessory catalog...');
    await client`
      INSERT INTO accessory_catalog (name, default_cost, default_selling_price, description) VALUES
        ('Sạc 20W USB-C', 150000, 250000, 'Sạc nhanh 20W cổng USB-C'),
        ('Sạc 35W Dual USB-C', 250000, 400000, 'Sạc nhanh 35W 2 cổng'),
        ('Cáp USB-C to USB-C 1m', 80000, 150000, 'Cáp sạc USB-C 1m'),
        ('Cáp USB-C to Lightning 1m', 90000, 180000, 'Cáp sạc Lightning 1m'),
        ('Ốp lưng silicon', 50000, 100000, 'Ốp silicon trong suốt'),
        ('Cường lực màn hình', 30000, 80000, 'Kính cường lực 9H');
    `;

    console.log('✅ ACCESSORY SCHEMA MIGRATION COMPLETED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ MIGRATION FAILED:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
