import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in .env.local');
  process.exit(1);
}

async function main() {
  console.log('🔄 STARTING DATABASE ROLE MIGRATION...');
  const client = postgres(connectionString!, { max: 1 });

  try {
    // 1. Drop the default on the profiles.role column so we can change its type
    console.log('1. Dropping default on profiles.role column...');
    await client`ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;`;

    // 2. Rename the old enum type to user_role_old
    console.log('2. Renaming old user_role enum to user_role_old...');
    await client`ALTER TYPE user_role RENAME TO user_role_old;`;

    // 3. Create the new user_role enum with ('admin', 'staff')
    console.log('3. Creating new user_role enum with (\'admin\', \'staff\')...');
    await client`CREATE TYPE user_role AS ENUM ('admin', 'staff');`;

    // 4. Alter the profiles.role column to use the new user_role enum,
    // mapping 'owner' and 'manager' to 'admin', and preserving 'staff'
    console.log('4. Altering profiles.role column type and mapping values...');
    await client`
      ALTER TABLE profiles 
      ALTER COLUMN role TYPE user_role 
      USING (
        CASE 
          WHEN role::text IN ('owner', 'manager') THEN 'admin'::user_role
          ELSE role::text::user_role
        END
      );
    `;

    // 5. Restore the default value of 'staff' to the profiles.role column
    console.log('5. Restoring default value to profiles.role...');
    await client`ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'staff'::user_role;`;

    // 6. Drop the old user_role_old enum
    console.log('6. Dropping the old user_role_old enum...');
    await client`DROP TYPE user_role_old;`;

    console.log('✅ DATABASE ROLE MIGRATION COMPLETED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ MIGRATION FAILED:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
