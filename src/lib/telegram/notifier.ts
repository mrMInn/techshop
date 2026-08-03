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
  | "low_stock_alert"
  | "warranty_status_changed"
  | "inventory_updated"
  | "inventory_added";

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
    `👉 <i>Vui lòng liên hệ nhà cung cấp để lên kế hoạch nhập hàng!</i>`,

  warranty_status_changed: 
    `<b>🔄 CẬP NHẬT TRẠNG THÁI BẢO HÀNH</b>\n\n` +
    `• <b>Mã phiếu:</b> <code>{claim_number}</code>\n` +
    `• <b>Thiết bị:</b> {product_name}\n` +
    `• <b>Mã Serial (SN):</b> <code>{serial_number}</code>\n` +
    `• <b>Khách hàng:</b> {customer_name} ({customer_phone})\n` +
    `• <b>Trạng thái mới:</b> <b>{new_status}</b>\n` +
    `• <b>Chi phí sửa chữa:</b> {repair_cost}\n` +
    `• <b>Nội dung diễn giải:</b> <i>{description}</i>`,

  inventory_updated:
    `<b>📦 CẬP NHẬT THÔNG TIN THIẾT BỊ KHO</b>\n\n` +
    `• <b>Sản phẩm:</b> {product_name}\n` +
    `• <b>Mã Serial (SN):</b> <code>{serial_number}</code>\n` +
    `• <b>Trạng thái kho:</b> <b>{status}</b>\n\n` +
    `🛠️ <b>Chi tiết thay đổi:</b>\n<i>{change_log}</i>`,

  inventory_added:
    `<b>📥 NHẬP LÔ THIẾT BỊ MỚI VÀO KHO</b>\n\n` +
    `• <b>Sản phẩm:</b> {product_name}\n` +
    `• <b>Số lượng:</b> <b>{quantity} máy</b>\n` +
    `• <b>Tình trạng:</b> {condition}\n` +
    `• <b>Đơn giá vốn:</b> {cost_price}\n` +
    `• <b>Trạng thái:</b> {status}\n\n` +
    `📋 <b>Danh sách Serial (SN):</b>\n{serials_list}`
};

/**
 * Gửi thông báo tự động tới Telegram Bot dựa theo cấu hình trong CSDL
 */
export async function sendTelegramNotification(
  eventType: TelegramNotificationType,
  variables: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Kiểm tra biến môi trường hoặc truy vấn cấu hình chính
    const envBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const envChatId = process.env.TELEGRAM_CHAT_ID;

    const settingsList = await db.select().from(telegramSettings).limit(1);
    const config = settingsList[0] || { isActive: true, botToken: "", chatId: "", id: null };

    const activeBotToken = envBotToken || config.botToken;
    const activeChatId = envChatId || config.chatId;
    const activeIsActive = envBotToken ? true : config.isActive;

    if (!activeIsActive || !activeBotToken || !activeChatId) {
      return { success: false, error: "Tính năng thông báo Telegram đang tắt hoặc thiếu Token/Chat ID" };
    }

    // 2. Truy vấn sự kiện xem có bị tắt không
    let isEnabled = true;
    let templateText = DEFAULT_TEMPLATES[eventType];

    const VALID_ENUM_VALUES = [
      'order_created', 'order_completed', 'order_cancelled',
      'inventory_added', 'inventory_sold',
      'purchase_order_created', 'purchase_order_received',
      'warranty_created', 'warranty_status_changed',
      'expense_created', 'payment_received',
      'user_login', 'low_stock_alert'
    ];

    if (config.id && VALID_ENUM_VALUES.includes(eventType)) {
      const eventConfig = await db
        .select()
        .from(telegramNotificationEvents)
        .where(
          and(
            eq(telegramNotificationEvents.telegramSettingId, config.id),
            eq(telegramNotificationEvents.eventType, eventType as any)
          )
        )
        .limit(1);

      if (eventConfig.length > 0) {
        isEnabled = eventConfig[0].isEnabled;
        templateText = eventConfig[0].template || DEFAULT_TEMPLATES[eventType];
      }
    }

    if (!isEnabled) {
      return { success: false, error: `Sự kiện ${eventType} đã bị tắt nhận thông báo` };
    }

    // 4. Thay thế các biến động dạng {placeholder} bằng dữ liệu thực tế
    // Ánh xạ tất cả các cặp biến camelCase <-> snake_case để tương thích ngược hoàn toàn với mọi phiên bản biểu mẫu
    const mappedVariables: Record<string, string> = { ...variables };
    
    // Ánh xạ chung
    if (variables.order_number) mappedVariables.orderNumber = variables.order_number;
    if (variables.orderNumber) mappedVariables.order_number = variables.orderNumber;
    
    if (variables.customer_name) mappedVariables.customerName = variables.customer_name;
    if (variables.customerName) mappedVariables.customer_name = variables.customerName;

    if (variables.customer_phone) mappedVariables.customerPhone = variables.customer_phone;
    if (variables.customerPhone) mappedVariables.customer_phone = variables.customerPhone;

    if (variables.total_amount) mappedVariables.totalAmount = variables.total_amount;
    if (variables.totalAmount) mappedVariables.total_amount = variables.totalAmount;

    if (variables.payment_method) mappedVariables.paymentMethod = variables.payment_method;
    if (variables.paymentMethod) mappedVariables.payment_method = variables.paymentMethod;

    if (variables.items_list) mappedVariables.itemsList = variables.items_list;
    if (variables.itemsList) mappedVariables.items_list = variables.itemsList;

    if (variables.product_name) mappedVariables.productName = variables.product_name;
    if (variables.productName) mappedVariables.product_name = variables.productName;

    if (variables.serial_number) mappedVariables.serialNumber = variables.serial_number;
    if (variables.serialNumber) mappedVariables.serial_number = variables.serialNumber;

    if (variables.claim_number) mappedVariables.claimNumber = variables.claim_number;
    if (variables.claimNumber) mappedVariables.claim_number = variables.claimNumber;

    if (variables.issue_description) mappedVariables.issueDescription = variables.issue_description;
    if (variables.issueDescription) mappedVariables.issue_description = variables.issueDescription;

    if (variables.new_status) mappedVariables.newStatus = variables.new_status;
    if (variables.newStatus) mappedVariables.new_status = variables.newStatus;

    if (variables.repair_cost) mappedVariables.repairCost = variables.repair_cost;
    if (variables.repairCost) mappedVariables.repair_cost = variables.repairCost;

    // Chi tiết chi phí & danh mục chi
    if (variables.expense_number) mappedVariables.entryNumber = variables.expense_number;
    if (variables.entryNumber) mappedVariables.expense_number = variables.entryNumber;

    if (variables.income_number) mappedVariables.entryNumber = variables.income_number;
    if (variables.entryNumber && eventType === "payment_received") mappedVariables.income_number = variables.entryNumber;

    if (variables.category_name) mappedVariables.category = variables.category_name;
    if (variables.category) mappedVariables.category_name = variables.category;

    if (variables.expense_date) mappedVariables.expenseDate = variables.expense_date;
    if (variables.expenseDate) mappedVariables.expense_date = variables.expenseDate;

    if (variables.income_date) mappedVariables.incomeDate = variables.income_date;
    if (variables.incomeDate) mappedVariables.income_date = variables.incomeDate;

    // Tồn kho thấp
    if (variables.current_stock) mappedVariables.quantity = variables.current_stock;
    if (variables.quantity) mappedVariables.current_stock = variables.quantity;

    let finalMessage = templateText;
    Object.entries(mappedVariables).forEach(([key, val]) => {
      const placeholder = new RegExp(`{${key}}`, "g");
      finalMessage = finalMessage.replace(placeholder, val || "");
    });

    // 5. Gửi tin nhắn qua Telegram Bot API
    const url = `https://api.telegram.org/bot${activeBotToken.trim()}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: activeChatId.trim(),
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
