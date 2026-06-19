-- Custom SQL migration file, put your code below! --
DROP TABLE IF EXISTS "tax_declaration_items" CASCADE;
DROP TABLE IF EXISTS "tax_declarations" CASCADE;
DROP TYPE IF EXISTS "public"."tax_declaration_status";
DROP TYPE IF EXISTS "public"."tax_declaration_ref_type";