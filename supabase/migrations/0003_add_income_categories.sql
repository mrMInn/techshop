CREATE TABLE "income_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "income_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "cash_book_entries" ADD COLUMN "income_category_id" uuid;
--> statement-breakpoint
ALTER TABLE "cash_book_entries" ADD CONSTRAINT "cash_book_entries_income_category_id_income_categories_id_fk" FOREIGN KEY ("income_category_id") REFERENCES "public"."income_categories"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "income_categories" ("id", "name", "description") VALUES 
('10000000-0000-0000-0000-000000000001', 'Doanh thu bán lẻ', 'Thu tiền bán sản phẩm hoặc đơn hàng từ khách lẻ'),
('10000000-0000-0000-0000-000000000002', 'Phí dịch vụ bảo hành', 'Thu tiền từ sửa chữa dịch vụ hoặc bảo hành ngoài'),
('10000000-0000-0000-0000-000000000003', 'Thu nhập khác', 'Các khoản thu nhập khác phát sinh ngoài bán hàng và bảo hành')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "cash_book_entries" 
SET "income_category_id" = CASE 
    WHEN "category" = 'sales' THEN '10000000-0000-0000-0000-000000000001'::uuid
    WHEN "category" = 'warranty_repair' THEN '10000000-0000-0000-0000-000000000002'::uuid
    ELSE '10000000-0000-0000-0000-000000000003'::uuid
END
WHERE "type" = 'income' AND "reference_type" IS NULL;