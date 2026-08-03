"use server";

import { db } from "@/lib/db";
import { 
  telegramSettings, 
  telegramNotificationEvents, 
  profiles 
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

// 1. Tự động đồng bộ các cột mới vào DB (Self-healing database migration)
async function ensureDbSchema() {
  try {
    await db.execute(sql`
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS store_name TEXT;
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS store_address TEXT;
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS store_phone VARCHAR(50);
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS store_email VARCHAR(255);
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS store_tax_code VARCHAR(50);
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50);
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS bank_owner VARCHAR(100);
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS invoice_footer TEXT;
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS default_vat INTEGER DEFAULT 10;
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS default_warranty INTEGER DEFAULT 12;
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 2;
      ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS stock_aging_threshold INTEGER DEFAULT 90;
    `);
  } catch (error) {
    console.error("Lỗi đồng bộ tự động database schema:", error);
  }
}

// 2. Lấy cấu hình hệ thống hiện tại
export async function getSystemSettings() {
  try {
    // Luôn gọi hàm tự chữa lành để đảm bảo DB khớp schema
    await ensureDbSchema();

    const config = await db.select().from(telegramSettings).limit(1);
    const hasEnvConfig = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

    if (config.length === 0) {
      return { 
        settings: {
          botToken: process.env.TELEGRAM_BOT_TOKEN ? "••••••••••••••••" : "",
          chatId: process.env.TELEGRAM_CHAT_ID || "",
          isActive: true,
        } as any, 
        events: [],
        hasEnvConfig
      };
    }

    const events = await db
      .select()
      .from(telegramNotificationEvents)
      .where(eq(telegramNotificationEvents.telegramSettingId, config[0].id));

    // Nếu cấu hình DB rỗng nhưng có env config, điền sẵn thông tin env làm giá trị hiển thị giả
    const settings = { ...config[0] };
    if (!settings.botToken && process.env.TELEGRAM_BOT_TOKEN) {
      settings.botToken = "••••••••••••••••";
    }
    if (!settings.chatId && process.env.TELEGRAM_CHAT_ID) {
      settings.chatId = process.env.TELEGRAM_CHAT_ID;
    }

    return {
      settings,
      events,
      hasEnvConfig
    };
  } catch (error) {
    console.error("Lỗi truy xuất cấu hình hệ thống:", error);
    return { settings: null, events: [], hasEnvConfig: false };
  }
}

// 3. Lưu toàn bộ 3 phân hệ cấu hình
export async function saveSystemSettings(data: {
  botToken: string;
  chatId: string;
  isActive: boolean;
  
  // Store info
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  storeTaxCode?: string;
  
  // Bank details
  bankName?: string;
  bankAccount?: string;
  bankOwner?: string;
  
  // Terms
  invoiceFooter?: string;
  
  // Numbers
  defaultVat?: number;
  defaultWarranty?: number;
  lowStockThreshold?: number;
  stockAgingThreshold?: number;

  // Events configuration
  events: {
    eventType: 'order_created' | 'order_completed' | 'order_cancelled' | 'inventory_added' | 'warranty_created' | 'expense_created' | 'low_stock_alert';
    isEnabled: boolean;
    template?: string;
  }[];
}) {
  try {
    await ensureDbSchema();

    return await db.transaction(async (tx) => {
      // Tìm nhân viên lưu cấu hình (tài khoản đầu tiên trong DB)
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const createdById = ownerProfiles[0]?.id || null;

      const existingConfig = await tx.select().from(telegramSettings).limit(1);
      
      let settingId = "";
      const updateData = {
        botToken: data.botToken === "••••••••••••••••" ? (existingConfig[0]?.botToken || "") : data.botToken,
        chatId: data.chatId,
        isActive: data.isActive,
        
        storeName: data.storeName || null,
        storeAddress: data.storeAddress || null,
        storePhone: data.storePhone || null,
        storeEmail: data.storeEmail || null,
        storeTaxCode: data.storeTaxCode || null,
        
        bankName: data.bankName || null,
        bankAccount: data.bankAccount || null,
        bankOwner: data.bankOwner || null,
        
        invoiceFooter: data.invoiceFooter || null,
        
        defaultVat: data.defaultVat !== undefined ? data.defaultVat : 10,
        defaultWarranty: data.defaultWarranty !== undefined ? data.defaultWarranty : 12,
        lowStockThreshold: data.lowStockThreshold !== undefined ? data.lowStockThreshold : 2,
        stockAgingThreshold: data.stockAgingThreshold !== undefined ? data.stockAgingThreshold : 90,
        
        createdBy: createdById,
        updatedAt: new Date(),
      };

      if (existingConfig.length > 0) {
        settingId = existingConfig[0].id;
        await tx
          .update(telegramSettings)
          .set(updateData)
          .where(eq(telegramSettings.id, settingId));
      } else {
        const [inserted] = await tx
          .insert(telegramSettings)
          .values({
            ...updateData,
            createdAt: new Date(),
          })
          .returning();
        settingId = inserted.id;
      }

      // Lưu/Cập nhật các rules sự kiện
      for (const ev of data.events) {
        const existingEvent = await tx
          .select()
          .from(telegramNotificationEvents)
          .where(
            eq(telegramNotificationEvents.telegramSettingId, settingId) &&
            eq(telegramNotificationEvents.eventType, ev.eventType)
          )
          .limit(1);

        const eventData = {
          telegramSettingId: settingId,
          eventType: ev.eventType,
          isEnabled: ev.isEnabled,
          template: ev.template || null,
        };

        if (existingEvent.length > 0) {
          await tx
            .update(telegramNotificationEvents)
            .set(eventData)
            .where(eq(telegramNotificationEvents.id, existingEvent[0].id));
        } else {
          await tx.insert(telegramNotificationEvents).values(eventData);
        }
      }

      return { success: true, message: "Lưu cấu hình hệ thống thành công" };
    });
  } catch (error: any) {
    console.error("Lỗi khi lưu cấu hình hệ thống:", error);
    return { success: false, message: error.message || "Không thể lưu cấu hình" };
  }
}

// 4. Gửi thử nghiệm kết nối Telegram Bot
export async function testTelegramConnectionAction(botToken: string, chatId: string) {
  try {
    let cleanToken = botToken.trim();
    let cleanChatId = chatId.trim();

    if (cleanToken === "••••••••••••••••" && process.env.TELEGRAM_BOT_TOKEN) {
      cleanToken = process.env.TELEGRAM_BOT_TOKEN;
    }
    if ((!cleanChatId || cleanChatId === "") && process.env.TELEGRAM_CHAT_ID) {
      cleanChatId = process.env.TELEGRAM_CHAT_ID;
    }

    if (!cleanToken || !cleanChatId) {
      return { success: false, message: "Vui lòng nhập đầy đủ Bot Token và Chat ID hoặc cấu hình file .env.local" };
    }

    const testMessage = `<b>🔔 TechStore ERP — Kết nối kiểm thử thành công!</b>\n\nHệ thống thông báo real-time tự động đã thiết lập kết nối an toàn và sẵn sàng hoạt động.\n\n<i>Thời gian kiểm thử: ${new Date().toLocaleString("vi-VN")}</i>`;

    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: testMessage,
        parse_mode: "HTML",
      }),
    });

    const resJson = await res.json();

    if (res.ok && resJson.ok) {
      return { success: true, message: "Kết nối thành công! Đã gửi tin nhắn test đến Telegram." };
    } else {
      const errorMsg = resJson.description || "Máy chủ Telegram từ chối yêu cầu";
      return { success: false, message: `Kết nối thất bại: ${errorMsg}` };
    }
  } catch (error: any) {
    console.error("Lỗi kiểm thử kết nối Telegram:", error);
    return { success: false, message: `Lỗi kết nối: ${error.message || "Không thể kết nối đến Telegram API"}` };
  }
}
