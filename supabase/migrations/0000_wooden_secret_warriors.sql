CREATE TYPE "public"."cash_book_category" AS ENUM('sales', 'purchase', 'salary', 'rent', 'utility', 'shipping', 'tax', 'warranty_repair', 'other');--> statement-breakpoint
CREATE TYPE "public"."cash_book_payment_method" AS ENUM('cash', 'bank_transfer', 'card');--> statement-breakpoint
CREATE TYPE "public"."cash_book_ref_type" AS ENUM('order', 'purchase_order', 'expense', 'salary', 'tax', 'other');--> statement-breakpoint
CREATE TYPE "public"."cash_book_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."expense_payment_method" AS ENUM('cash', 'bank_transfer', 'card');--> statement-breakpoint
CREATE TYPE "public"."expense_type" AS ENUM('fixed', 'variable', 'one_time');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'manager', 'staff');--> statement-breakpoint
CREATE TYPE "public"."customer_type" AS ENUM('individual', 'business');--> statement-breakpoint
CREATE TYPE "public"."item_condition" AS ENUM('new', 'like_new', 'used_good', 'used_fair', 'refurbished');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('incoming', 'in_stock', 'reserved', 'sold', 'warranty_repair', 'returned', 'defective');--> statement-breakpoint
CREATE TYPE "public"."movement_ref_type" AS ENUM('purchase_order', 'order', 'warranty_claim', 'manual', 'stocktake');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('received', 'stocked', 'transferred', 'sold', 'warranty_in', 'warranty_out', 'returned', 'adjusted', 'checked', 'defective');--> statement-breakpoint
CREATE TYPE "public"."po_status" AS ENUM('draft', 'ordered', 'in_transit', 'partially_received', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'confirmed', 'processing', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_item_method" AS ENUM('cash', 'bank_transfer', 'card', 'momo', 'vnpay');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'bank_transfer', 'card', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'partial', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."sale_channel" AS ENUM('online', 'offline', 'phone');--> statement-breakpoint
CREATE TYPE "public"."quotation_status" AS ENUM('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted');--> statement-breakpoint
CREATE TYPE "public"."return_item_condition" AS ENUM('like_new', 'good', 'damaged', 'defective');--> statement-breakpoint
CREATE TYPE "public"."return_item_reason" AS ENUM('defective', 'cosmetic', 'wrong_specs', 'customer_request', 'other');--> statement-breakpoint
CREATE TYPE "public"."return_reason" AS ENUM('defective', 'wrong_item', 'changed_mind', 'upgrade', 'downgrade', 'other');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('pending', 'approved', 'processing', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."return_type" AS ENUM('return', 'exchange');--> statement-breakpoint
CREATE TYPE "public"."warranty_status" AS ENUM('pending', 'inspecting', 'repairing', 'waiting_parts', 'completed', 'rejected', 'replaced');--> statement-breakpoint
CREATE TYPE "public"."tax_period_type" AS ENUM('monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."tax_status" AS ENUM('draft', 'submitted', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."telegram_event_type" AS ENUM('order_created', 'order_completed', 'order_cancelled', 'inventory_added', 'inventory_sold', 'purchase_order_created', 'purchase_order_received', 'warranty_created', 'warranty_status_changed', 'expense_created', 'payment_received', 'user_login', 'low_stock_alert');--> statement-breakpoint
CREATE TYPE "public"."telegram_log_status" AS ENUM('sent', 'failed', 'retrying');--> statement-breakpoint
CREATE TABLE "cash_book_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" varchar(30) NOT NULL,
	"type" "cash_book_type" NOT NULL,
	"category" "cash_book_category" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"running_balance" numeric(15, 2) NOT NULL,
	"payment_method" "cash_book_payment_method" NOT NULL,
	"reference_type" "cash_book_ref_type",
	"reference_id" uuid,
	"description" text NOT NULL,
	"entry_date" date NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_book_entries_entry_number_unique" UNIQUE("entry_number")
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "expense_type" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_number" varchar(30) NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"description" text NOT NULL,
	"expense_date" date NOT NULL,
	"payment_method" "expense_payment_method" NOT NULL,
	"receipt_url" text,
	"is_tax_deductible" boolean DEFAULT false NOT NULL,
	"supplier_id" uuid,
	"approved_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_expense_number_unique" UNIQUE("expense_number")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" varchar(100) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_phone_unique" UNIQUE("phone"),
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(100) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255),
	"address" text,
	"tax_code" varchar(20),
	"customer_type" "customer_type" DEFAULT 'individual' NOT NULL,
	"lead_source_id" uuid,
	"notes" text,
	"total_spent" numeric(15, 2) DEFAULT '0' NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"icon" varchar(50),
	"color" varchar(7),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"sku" varchar(50),
	"category_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"description" text,
	"specs" jsonb,
	"warranty_months" integer DEFAULT 12 NOT NULL,
	"images" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serial_number" varchar(100) NOT NULL,
	"product_id" uuid NOT NULL,
	"purchase_order_item_id" uuid,
	"condition" "item_condition" NOT NULL,
	"status" "item_status" DEFAULT 'incoming' NOT NULL,
	"cost_price" numeric(15, 2) NOT NULL,
	"selling_price" numeric(15, 2),
	"specs_override" jsonb,
	"origin_country" varchar(50) DEFAULT 'VN',
	"location" varchar(100),
	"expected_arrival_date" date,
	"received_date" date,
	"stocked_date" date,
	"sold_date" date,
	"warranty_start" date,
	"warranty_end" date,
	"notes" text,
	"images" text[],
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"movement_type" "movement_type" NOT NULL,
	"from_status" varchar(30),
	"to_status" varchar(30) NOT NULL,
	"reference_type" "movement_ref_type" NOT NULL,
	"reference_id" uuid,
	"quantity_change" integer NOT NULL,
	"location_from" varchar(100),
	"location_to" varchar(100),
	"notes" text,
	"performed_by" uuid NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(15, 2) NOT NULL,
	"total_cost" numeric(15, 2) NOT NULL,
	"received_quantity" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_number" varchar(30) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "po_status" DEFAULT 'draft' NOT NULL,
	"origin_country" varchar(50) DEFAULT 'VN',
	"shipping_method" varchar(100),
	"tracking_number" varchar(100),
	"tracking_url" text,
	"expected_arrival" date,
	"actual_arrival" date,
	"shipping_cost" numeric(15, 2) DEFAULT '0',
	"tax_import" numeric(15, 2) DEFAULT '0',
	"total_cost" numeric(15, 2) NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"contact_name" varchar(100),
	"phone" varchar(20),
	"email" varchar(255),
	"address" text,
	"country" varchar(50) DEFAULT 'VN',
	"tax_code" varchar(20),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"selling_price" numeric(15, 2) NOT NULL,
	"cost_price" numeric(15, 2) NOT NULL,
	"discount" numeric(15, 2) DEFAULT '0',
	"profit" numeric(15, 2),
	"warranty_months" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(30) NOT NULL,
	"customer_id" uuid NOT NULL,
	"lead_source_id" uuid,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"sale_channel" "sale_channel" NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"discount_amount" numeric(15, 2) DEFAULT '0',
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"total_amount" numeric(15, 2) NOT NULL,
	"total_cost" numeric(15, 2) NOT NULL,
	"profit" numeric(15, 2),
	"profit_margin" numeric(5, 2),
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"payment_method" "payment_method",
	"shipping_address" text,
	"notes" text,
	"sold_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"payment_method" "payment_item_method" NOT NULL,
	"payment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"reference_number" varchar(100),
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"inventory_item_id" uuid,
	"product_id" uuid NOT NULL,
	"quoted_price" numeric(15, 2) NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_number" varchar(30) NOT NULL,
	"share_token" varchar(64) NOT NULL,
	"customer_id" uuid,
	"customer_name" varchar(100),
	"customer_phone" varchar(20),
	"lead_source_id" uuid,
	"status" "quotation_status" DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"discount_amount" numeric(15, 2) DEFAULT '0',
	"total_amount" numeric(15, 2) NOT NULL,
	"valid_until" date,
	"notes" text,
	"internal_notes" text,
	"converted_order_id" uuid,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_quote_number_unique" UNIQUE("quote_number"),
	CONSTRAINT "quotations_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"return_reason" "return_item_reason" NOT NULL,
	"condition_on_return" "return_item_condition" NOT NULL,
	"is_defective" boolean DEFAULT false NOT NULL,
	"defect_description" text,
	"original_price" numeric(15, 2) NOT NULL,
	"refund_price" numeric(15, 2) NOT NULL,
	"new_inventory_item_id" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" varchar(30) NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" "return_type" NOT NULL,
	"reason" "return_reason" NOT NULL,
	"reason_detail" text NOT NULL,
	"status" "return_status" DEFAULT 'pending' NOT NULL,
	"has_fee" boolean DEFAULT false NOT NULL,
	"fee_amount" numeric(15, 2) DEFAULT '0',
	"refund_amount" numeric(15, 2) DEFAULT '0',
	"exchange_difference" numeric(15, 2) DEFAULT '0',
	"new_order_id" uuid,
	"notes" text,
	"processed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "returns_return_number_unique" UNIQUE("return_number")
);
--> statement-breakpoint
CREATE TABLE "warranty_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_number" varchar(30) NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "warranty_status" DEFAULT 'pending' NOT NULL,
	"issue_description" text NOT NULL,
	"diagnosis" text,
	"resolution" text,
	"repair_cost" numeric(15, 2) DEFAULT '0',
	"is_under_warranty" boolean NOT NULL,
	"warranty_end_date" date NOT NULL,
	"received_date" date NOT NULL,
	"expected_return_date" date,
	"actual_return_date" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warranty_claims_claim_number_unique" UNIQUE("claim_number")
);
--> statement-breakpoint
CREATE TABLE "warranty_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warranty_claim_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"old_status" varchar(30),
	"new_status" varchar(30),
	"attachments" text[],
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_type" "tax_period_type" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_revenue" numeric(15, 2) NOT NULL,
	"total_cost_of_goods" numeric(15, 2) NOT NULL,
	"total_expenses" numeric(15, 2) NOT NULL,
	"gross_profit" numeric(15, 2),
	"net_profit" numeric(15, 2),
	"vat_output" numeric(15, 2) DEFAULT '0',
	"vat_input" numeric(15, 2) DEFAULT '0',
	"vat_payable" numeric(15, 2),
	"income_tax_rate" numeric(5, 2) DEFAULT '20',
	"income_tax" numeric(15, 2),
	"status" "tax_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_setting_id" uuid NOT NULL,
	"event_type" "telegram_event_type" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"template" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_setting_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"status" "telegram_log_status" NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_token" text NOT NULL,
	"chat_id" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(50) NOT NULL,
	"table_name" varchar(50) NOT NULL,
	"record_id" uuid NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"ip_address" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_book_entries" ADD CONSTRAINT "cash_book_entries_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_profiles_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_lead_source_id_lead_sources_id_fk" FOREIGN KEY ("lead_source_id") REFERENCES "public"."lead_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_performed_by_profiles_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_lead_source_id_lead_sources_id_fk" FOREIGN KEY ("lead_source_id") REFERENCES "public"."lead_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_sold_by_profiles_id_fk" FOREIGN KEY ("sold_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_lead_source_id_lead_sources_id_fk" FOREIGN KEY ("lead_source_id") REFERENCES "public"."lead_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_converted_order_id_orders_id_fk" FOREIGN KEY ("converted_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_new_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("new_inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_new_order_id_orders_id_fk" FOREIGN KEY ("new_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_processed_by_profiles_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_logs" ADD CONSTRAINT "warranty_logs_warranty_claim_id_warranty_claims_id_fk" FOREIGN KEY ("warranty_claim_id") REFERENCES "public"."warranty_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_logs" ADD CONSTRAINT "warranty_logs_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_declarations" ADD CONSTRAINT "tax_declarations_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_notification_events" ADD CONSTRAINT "telegram_notification_events_telegram_setting_id_telegram_settings_id_fk" FOREIGN KEY ("telegram_setting_id") REFERENCES "public"."telegram_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_notification_logs" ADD CONSTRAINT "telegram_notification_logs_telegram_setting_id_telegram_settings_id_fk" FOREIGN KEY ("telegram_setting_id") REFERENCES "public"."telegram_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD CONSTRAINT "telegram_settings_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cashbook_date" ON "cash_book_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "idx_cashbook_type" ON "cash_book_entries" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_customers_lead_source" ON "customers" USING btree ("lead_source_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_serial" ON "inventory_items" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "idx_inventory_status" ON "inventory_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inventory_product" ON "inventory_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_stocked" ON "inventory_items" USING btree ("stocked_date");--> statement-breakpoint
CREATE INDEX "idx_inv_movements_item" ON "inventory_movements" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_inv_movements_type" ON "inventory_movements" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "idx_inv_movements_date" ON "inventory_movements" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "idx_inv_movements_by" ON "inventory_movements" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_orders_customer" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_orders_created" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_orders_sold_by" ON "orders" USING btree ("sold_by");--> statement-breakpoint
CREATE INDEX "idx_orders_lead_source" ON "orders" USING btree ("lead_source_id");--> statement-breakpoint
CREATE INDEX "idx_warranty_inventory" ON "warranty_claims" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_warranty_order" ON "warranty_claims" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_warranty_status" ON "warranty_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_telegram_logs_event" ON "telegram_notification_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_telegram_logs_status" ON "telegram_notification_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_telegram_logs_sent" ON "telegram_notification_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_audit_table" ON "audit_logs" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "audit_logs" USING btree ("user_id");