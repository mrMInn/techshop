-- Custom SQL migration file, put your code below! --
CREATE INDEX IF NOT EXISTS "idx_inventory_po_item" ON "inventory_items" USING btree ("purchase_order_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_supplier" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_po_items_po" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_po_items_product" ON "purchase_order_items" USING btree ("product_id");