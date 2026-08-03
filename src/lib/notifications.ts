import { sendTelegramNotification } from "./telegram/notifier";
import { db } from "@/lib/db";
import { telegramSettings } from "@/lib/db/schema";
import nodemailer from "nodemailer";

// Kiểu sự kiện hệ thống
export type SystemNotificationType =
  | "order_created"
  | "order_completed"
  | "order_cancelled"
  | "warranty_created"
  | "expense_created"
  | "payment_received"
  | "low_stock_alert"
  | "warranty_status_changed"
  | "inventory_updated"
  | "inventory_added";

// Tiêu đề email tiếng Việt tương ứng với sự kiện
const EMAIL_SUBJECTS: Record<string, string> = {
  order_created: "🔔 Thông báo: Đơn hàng mới đã được tạo",
  order_completed: "🎉 Thành công: Giao dịch đơn hàng hoàn tất",
  order_cancelled: "⚠️ Cảnh báo: Giao dịch đơn hàng bị HỦY",
  warranty_created: "🔧 Tiếp nhận: Thiết bị bảo hành mới",
  warranty_status_changed: "🔄 Cập nhật: Trạng thái bảo hành sửa chữa thiết bị",
  inventory_updated: "📦 Cảnh báo: Cập nhật thông tin thiết bị trong kho",
  inventory_added: "📥 Thông báo: Nhập thiết bị mới vào kho",
  expense_created: "💸 Chi phí: Phát sinh khoản chi vận hành mới",
  payment_received: "💰 Thu quỹ: Phát sinh phiếu thu tiền thủ công",
  low_stock_alert: "🚨 Báo động: Tồn kho dưới ngưỡng an toàn"
};

/**
 * Hàm gửi email thông báo sự kiện ERP
 */
export async function sendEmailNotification(
  eventType: string,
  variables: Record<string, string>
) {
  try {
    // 1. Lấy email nhận từ cài đặt hệ thống hoặc môi trường
    const settingsList = await db.select().from(telegramSettings).limit(1);
    const config = settingsList[0];
    const emailTo = config?.storeEmail || process.env.SMTP_TO || "";
    
    if (!emailTo) {
      console.log(`[EMAIL NOTIFY] Bỏ qua: Chưa cấu hình email nhận (storeEmail hoặc SMTP_TO).`);
      return { success: false, error: "Missing email receiver" };
    }

    const host = process.env.SMTP_HOST || "";
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";
    const from = process.env.SMTP_FROM || `"TechStore ERP" <no-reply@techstore.vn>`;

    // Xây dựng nội dung HTML email dựa trên sự kiện
    const subject = EMAIL_SUBJECTS[eventType] || `[TechStore ERP] Sự kiện ${eventType}`;
    let htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e3e3e8; border-radius: 20px; padding: 24px; color: #1d1d1f;">
        <div style="border-bottom: 1px solid #e0e0e0; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #0066cc;">TechStore ERP AI</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #7a7a7a;">Thông báo tự động từ hệ thống quản lý</p>
        </div>
        <div style="font-size: 14px; line-height: 1.6; color: #333;">
          <p style="font-weight: bold; font-size: 15px; margin-bottom: 16px;">${subject}</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px;">
    `;

    Object.entries(variables).forEach(([key, val]) => {
      // Format tên biến đẹp đẽ
      const formattedKey = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());

      htmlContent += `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #f5f5f7; font-weight: 600; color: #7a7a7a; width: 35%;">${formattedKey}:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f5f5f7; color: #1d1d1f;">${val || "N/A"}</td>
        </tr>
      `;
    });

    htmlContent += `
          </table>
        </div>
        <div style="border-top: 1px solid #e0e0e0; padding-top: 16px; margin-top: 20px; font-size: 11px; color: #7a7a7a; text-align: center;">
          <p style="margin: 0;">Đây là email tự động. Quý khách vui lòng không phản hồi trực tiếp email này.</p>
          <p style="margin: 4px 0 0 0;">© ${new Date().getFullYear()} TechStore Laptop. All rights reserved.</p>
        </div>
      </div>
    `;

    // 2. Nếu có cấu hình tài khoản SMTP, tiến hành gửi thư thực tế qua Nodemailer
    if (host && user && pass) {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });

      await transporter.sendMail({
        from,
        to: emailTo,
        subject,
        html: htmlContent
      });

      console.log(`[EMAIL NOTIFY] Đã gửi email sự kiện ${eventType} thành công tới ${emailTo}`);
      return { success: true };
    } else {
      // Ghi nhận mock log trong console khi chưa cấu hình tài khoản SMTP gửi email
      console.log("=========================================");
      console.log(`[EMAIL NOTIFY] (SMTP CHƯA CẤU HÌNH - MOCK LOG)`);
      console.log(`- Gửi tới: ${emailTo}`);
      console.log(`- Tiêu đề: ${subject}`);
      console.log(`- Nội dung các trường:`, variables);
      console.log("=========================================");
      return { success: true, mock: true };
    }
  } catch (error: any) {
    console.error("Lỗi gửi Email thông báo:", error.message || error);
    return { success: false, error: error.message || error };
  }
}

/**
 * Điểm phân phối thông báo tập trung chính cho ERP
 * Tự động phân phối đến các kênh: Telegram, Email
 */
export async function sendSystemNotification(
  eventType: SystemNotificationType,
  variables: Record<string, string>
) {
  // Gửi Telegram
  try {
    await sendTelegramNotification(eventType as any, variables);
  } catch (err) {
    console.error("Lỗi khi gửi thông báo Telegram:", err);
  }

  // Gửi Email
  try {
    await sendEmailNotification(eventType, variables);
  } catch (err) {
    console.error("Lỗi khi gửi thông báo Email:", err);
  }
}
