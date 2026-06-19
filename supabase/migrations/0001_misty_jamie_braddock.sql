-- Step 1: Convert condition column to text temporarily
ALTER TABLE "inventory_items" ALTER COLUMN "condition" SET DATA TYPE text;

-- Step 2: Migrate existing data - convert old condition values to 'new' or 'used'
UPDATE "inventory_items" SET "condition" = 'used' WHERE "condition" IN ('like_new', 'used_good', 'used_fair', 'refurbished');

-- Step 3: Drop old enum and create new one
DROP TYPE "public"."item_condition";
CREATE TYPE "public"."item_condition" AS ENUM('new', 'used');

-- Step 4: Cast column back to the new enum type
ALTER TABLE "inventory_items" ALTER COLUMN "condition" SET DATA TYPE "public"."item_condition" USING "condition"::"public"."item_condition";