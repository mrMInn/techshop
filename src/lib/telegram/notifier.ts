import { db } from "@/lib/db";
import { 
  telegramSettings, 
  telegramNotificationEvents, 
  telegramNotificationLogs 
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// 1. Định nghĩa kiểu dữ liệu truyền vào hàm thông báo
export type TelegramNotificationType = 
  | "order_created"
  | "order_completed"
  | "order_cancelled"
  | "warranty_created"
  | "expense_created"
  | "payment_received"
  | "low_stock_alert";

// 2. Định nghĩa các mẫu mặc định tinh tế
const DEFAULT_TEMPLATES: Record<TelegramNotificationType, string> = {
  order_created: 
    `<b>🔔 ĐƠN HÀNG MỚI ĐÃ TẠO</b>\n\n` +
    `• <b>Mã đơn:</b> <code>{order_number}</code>\n` +
    `• <b>Khách hàng:</b> {customer_name} ({customer_phone})\n` +
    `• <b>Thanh toán:</b> {payment_method}\n` +
    `• <b>Tổng trị giá:</b> <b>{total_amount}</b>\n\n` +
    `📦 <b>Sản phẩm đã bán:</b>\n{items_list}`,

  order_completed: 
    `<b>🎉 ĐƠN HÀNG HOÀN TẤT THÀNH CÔNG</b>\n\n` +
    `• <b>Mã đơn:</b> <code>{order_number}</code>\n` +
    `• <b>Khách hàng:</b> {customer_name} ({customer_phone})\n` +
    `• <b>Thanh toán:</b> {payment_method}\n` +
    `• <b>Doanh thu:</b> <b>{total_amount}</b>\n\n` +
    `📦 <b>Chi tiết thiết bị:</b>\n{items_list}\n\n` +
    `<i>Chúc mừng giao dịch thành công! 🚀</i>`,

  order_cancelled: 
    `<b>⚠️ THÔNG BÁO HỦY ĐƠN HÀNG</b>\n\n` +
    `• <b>Mã đơn:</b> <code>{order_number}</code>\n` +
    `• <b>Khách hàng:</b> {customer_name}\n` +
    `• <b>Tổng tiền đơn hủy:</b> {total_amount}\n` +
    `• <b>Lý do hủy đơn:</b> <i>{reason}</i>\n\n` +
    `<i>Dòng tiền và trạng thái thiết bị trong kho đã được khôi phục.</i>`,

  warranty_created: 
    `<b>🔧 TIẾP NHẬN BẢO HÀNH & SỬA CHỮA</b>\n\n` +
    `• <b>Mã phiếu:</b> <code>{claim_number}</code>\n` +
    `• <b>Khách hàng:</b> {customer_name} ({customer_phone})\n` +
    `• <b>Thiết bị:</b> {product_name}\n` +
    `• <b>Số Serial (SN):</b> <code>{serial_number}</code>\n` +
    `• <b>Mô tả lỗi gặp phải:</b> <i>{issue_description}</i>\n\n` +
    `<i>Kỹ thuật viên đang tiến hành kiểm tra thiết bị.</i>`,

  expense_created: 
    `<b>💸 PHÁT SINH KHOẢN CHI VẬN HÀNH</b>\n\n` +
    `• <b>Mã chứng từ chi:</b> <code>{expense_number}</code>\n` +
    `• <b>Ngày ghi nhận:</b> {expense_date}\n` +
    `• <b>Danh mục chi phí:</b> <b>{category_name}</b>\n` +
    `• <b>Số tiền chi âm:</b> <code style="color: #ff3b30">-{amount}</code>\n` +
    `• <b>Phương thức:</b> {payment_method}\n` +
    `• <b>Nội dung diễn giải:</b> <i>{description}</i>`,

  payment_received: 
    `<b>💰 PHÁT SINH PHIẾU THU THỦ CÔNG</b>\n\n` +
    `• <b>Mã chứng từ thu:</b> <code>{income_number}</code>\n` +
    `• <b>Ngày ghi nhận:</b> {income_date}\n` +
    `• <b>Danh mục thu nhập:</b> <b>{category_name}</b>\n` +
    `• <b>Số tiền thu dương:</b> <code style="color: #34c759">+{amount}</code>\n` +
    `• <b>Phương thức:</b> {payment_method}\n` +
    `• <b>Nội dung diễn giải:</b> <i>{description}</i>`,

  low_stock_alert: 
    `<b>🚨 CẢNH BÁO TỒN KHO THẤP</b>\n\n` +
    `• <b>Sản phẩm:</b> <b>{product_name}</b>\n` +
    `• <b>Mã SKU:</b> <code>{sku}</code>\n` +
    `• <b>Số lượng hiện tại:</b> <b>{current_stock} chiếc</b>\n` +
    `• <b>Ngưỡng an toàn tối thiểu:</b> {threshold} chiếc\n\n` +
    `👉 <i>Vui lòng liên hệ nhà cung cấp để lên kế hoạch nhập hàng!</i>`
};

/**
 * Gửi thông báo tự động tới Telegram Bot dựa theo cấu hình trong CSDL
 */
export async function sendTelegramNotification(
  eventType: TelegramNotificationType,
  variables: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Truy vấn cấu hình chính
    const settingsList = await db.select().from(telegramSettings).limit(1);
    if (settingsList.length === 0) {
      return { success: false, error: "Chưa cấu hình tài khoản Telegram trong cài đặt" };
    }

    const config = settingsList[0];
    
    // Nếu tính năng thông báo đang tắt hoặc thiếu thông tin kết nối
    if (!config.isActive || !config.botToken || !config.chatId) {
      return { success: false, error: "Tính năng thông báo Telegram đang tắt hoặc thiếu Token/Chat ID" };
    }

    // 2. Truy vấn sự kiện xem có bị tắt không
    const eventConfig = await db
      .select()
      .from(telegramNotificationEvents)
      .where(
        and(
          eq(telegramNotificationEvents.telegramSettingId, config.id),
          eq(telegramNotificationEvents.eventType, eventType)
        )
      )
      .limit(1);

    // Nếu cấu hình sự kiện tồn tại nhưng bị tắt (isEnabled = false)
    if (eventConfig.length > 0 && !eventConfig[0].isEnabled) {
      return { success: false, error: `Sự kiện ${eventType} đã bị tắt nhận thông báo` };
    }

    // 3. Chuẩn bị mẫu tin nhắn (Ưu tiên mẫu trong DB, nếu trống dùng mặc định)
    let templateText = eventConfig[0]?.template || DEFAULT_TEMPLATES[eventType];
    if (!templateText) {
      templateText = DEFAULT_TEMPLATES[eventType];
    }

    // 4. Thay thế các biến động dạng {placeholder} bằng dữ liệu thực tế
    let finalMessage = templateText;
    Object.entries(variables).forEach(([key, val]) => {
      const placeholder = new RegExp(`{${key}}`, "g");
      finalMessage = finalMessage.replace(placeholder, val || "");
    });

    // 5. Gửi tin nhắn qua Telegram Bot API
    const url = `https://api.telegram.org/bot${config.botToken.trim()}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: config.chatId.trim(),
        text: finalMessage,
        parse_mode: "HTML",
      }),
    });

    const resJson = await res.json();
    const isSent = res.ok && resJson.ok;

    // 6. Ghi nhận lịch sử gửi thông báo vào bảng Logs trong CSDL
    await db.insert(telegramNotificationLogs).values({
      telegramSettingId: config.id,
      eventType: eventType,
      message: finalMessage,
      status: isSent ? "sent" : "failed",
      errorMessage: isSent ? null : (resJson.description || "Máy chủ Telegram không phản hồi"),
      sentAt: new Date(),
    });

    if (isSent) {
      return { success: true };
    } else {
      return { success: false, error: resJson.description || "Gửi tin nhắn Telegram không thành công" };
    }
  } catch (err: any) {
    console.error(`Lỗi hệ thống khi đẩy thông báo Telegram (${eventType}):`, err);
    return { success: false, error: err.message || "Internal system error in notifier" };
  }
}
