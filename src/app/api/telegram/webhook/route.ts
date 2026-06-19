import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { 
  inventoryItems, 
  quotations, 
  quotationItems, 
  products,
  telegramSettings,
  telegramNotificationLogs,
  orders,
  expenses,
  warrantyClaims
} from "@/lib/db/schema";
import { eq, sql, and, desc, gte, lte, or, ilike } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Chuyển đổi Markdown thô sang HTML đơn giản để tương thích Telegram
function markdownToHtml(text: string): string {
  let formatted = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  formatted = formatted.replace(/\*(.*?)\*/g, "<i>$1</i>");
  formatted = formatted.replace(/`(.*?)`/g, "<code>$1</code>");
  return formatted;
}

// Lấy hoặc tạo cấu hình cài đặt Telegram để có telegramSettingId
async function getOrCreateTelegramSetting() {
  const settings = await db.select().from(telegramSettings).limit(1);
  if (settings.length > 0) {
    return settings[0];
  }
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  
  if (botToken && chatId) {
    const [newSetting] = await db.insert(telegramSettings).values({
      botToken,
      chatId,
      isActive: true,
      storeName: "TechStore",
    }).returning();
    return newSetting;
  }
  
  return null;
}



// Tool 1: Thống kê trạng thái kho hàng
async function getInventoryStats() {
  const stats = await db
    .select({
      status: inventoryItems.status,
      count: sql<number>`count(*)`
    })
    .from(inventoryItems)
    .groupBy(inventoryItems.status);
  
  return stats;
}

// Tool 2: Tìm kiếm thiết bị kho hàng
async function searchInventoryItems(query: string) {
  const searchResult = await db
    .select({
      serialNumber: inventoryItems.serialNumber,
      status: inventoryItems.status,
      condition: inventoryItems.condition,
      costPrice: inventoryItems.costPrice,
      sellingPrice: inventoryItems.sellingPrice,
      productName: products.name,
    })
    .from(inventoryItems)
    .innerJoin(products, eq(inventoryItems.productId, products.id))
    .where(
      or(
        ilike(products.name, `%${query}%`),
        ilike(inventoryItems.serialNumber, `%${query}%`)
      )
    )
    .limit(5);
  
  return searchResult;
}

// Tool 3: Lấy báo cáo tài chính (Doanh thu, Lợi nhuận, Chi phí hôm nay và tháng này)
async function getFinancialReportForBot() {
  const todayStr = new Date().toISOString().split("T")[0];
  const startOfMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 0, 0, 0, 0);

  // 1. Thống kê HÔM NAY
  // A. Đơn hàng và doanh thu, lợi nhuận hôm nay
  const todayOrders = await db
    .select({
      count: sql<number>`count(*)`,
      totalAmount: sql<number>`sum(${orders.totalAmount})`,
      totalProfit: sql<number>`sum(${orders.profit})`
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "completed"),
        gte(orders.createdAt, todayStart),
        lte(orders.createdAt, todayEnd)
      )
    );

  // B. Chi phí hôm nay
  const todayExpenses = await db
    .select({
      totalAmount: sql<number>`sum(${expenses.amount})`
    })
    .from(expenses)
    .where(
      eq(expenses.expenseDate, todayStr)
    );

  // 2. Thống kê THÁNG NÀY
  // A. Đơn hàng, doanh thu, lợi nhuận tháng này
  const monthOrders = await db
    .select({
      count: sql<number>`count(*)`,
      totalAmount: sql<number>`sum(${orders.totalAmount})`,
      totalProfit: sql<number>`sum(${orders.profit})`
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "completed"),
        gte(orders.createdAt, startOfMonth)
      )
    );

  // B. Chi phí tháng này
  const monthExpenses = await db
    .select({
      totalAmount: sql<number>`sum(${expenses.amount})`
    })
    .from(expenses)
    .where(
      gte(expenses.expenseDate, startOfMonthStr)
    );

  return {
    today: {
      ordersCount: todayOrders[0]?.count || 0,
      revenue: Number(todayOrders[0]?.totalAmount || 0),
      profit: Number(todayOrders[0]?.totalProfit || 0),
      expenses: Number(todayExpenses[0]?.totalAmount || 0)
    },
    month: {
      ordersCount: monthOrders[0]?.count || 0,
      revenue: Number(monthOrders[0]?.totalAmount || 0),
      profit: Number(monthOrders[0]?.totalProfit || 0),
      expenses: Number(monthExpenses[0]?.totalAmount || 0)
    }
  };
}

// Tool 4: Tra cứu bảo hành theo mã Serial
async function getWarrantyStatusBySerial(serialNumber: string) {
  const itemQuery = await db
    .select({
      id: inventoryItems.id,
      serialNumber: inventoryItems.serialNumber,
      productName: products.name,
      warrantyStart: inventoryItems.warrantyStart,
      warrantyEnd: inventoryItems.warrantyEnd,
      status: inventoryItems.status,
    })
    .from(inventoryItems)
    .innerJoin(products, eq(inventoryItems.productId, products.id))
    .where(
      or(
        eq(inventoryItems.serialNumber, serialNumber.toUpperCase()),
        eq(inventoryItems.serialNumber, serialNumber)
      )
    )
    .limit(1);

  if (itemQuery.length === 0) {
    return { found: false };
  }

  const item = itemQuery[0];

  const claims = await db
    .select({
      claimNumber: warrantyClaims.claimNumber,
      status: warrantyClaims.status,
      issueDescription: warrantyClaims.issueDescription,
      receivedDate: warrantyClaims.receivedDate,
      actualReturnDate: warrantyClaims.actualReturnDate,
    })
    .from(warrantyClaims)
    .where(eq(warrantyClaims.inventoryItemId, item.id))
    .orderBy(desc(warrantyClaims.receivedDate));

  return {
    found: true,
    item,
    claims,
  };
}

// Bộ phân tích từ khóa cục bộ dự phòng (Fallback) khi Gemini API bị lỗi hoặc quota/429
async function handleLocalKeywordFallback(chatId: string | number, text: string, messageId: number) {
  const cleanText = text.toLowerCase();
  
  // 1. Phân tích bảo hành (chữ "bảo hành" và có serial dạng SN-...)
  const serialMatch = cleanText.match(/SN-[A-Za-z0-9-]+/i);
  if (cleanText.includes("bảo hành")) {
    if (serialMatch) {
      const serialNum = serialMatch[0].toUpperCase();
      try {
        const result = await getWarrantyStatusBySerial(serialNum);
        if (!result.found || !result.item) {
          await sendTelegramReply(
            chatId,
            `🔍 Không tìm thấy thiết bị nào có mã Serial <b>${serialNum}</b> trên hệ thống ERP để kiểm tra bảo hành.`,
            messageId
          );
          return;
        }

        const item = result.item;
        const formatDate = (dateVal: any) => {
          if (!dateVal) return "chưa xác định";
          return new Date(dateVal).toLocaleDateString('vi-VN');
        };

        const today = new Date();
        const endWarrantyDate = item.warrantyEnd ? new Date(item.warrantyEnd) : null;
        const isExpired = endWarrantyDate ? today > endWarrantyDate : true;

        let statusText = "";
        if (!item.warrantyStart && !item.warrantyEnd) {
          statusText = " Chưa kích hoạt bảo hành (chưa bán hoặc chưa kích hoạt).";
        } else if (isExpired) {
          statusText = `🔴 Hết hạn bảo hành từ ngày: <b>${formatDate(item.warrantyEnd)}</b>`;
        } else {
          statusText = `&nbsp;🟢 Còn hạn bảo hành đến ngày: <b>${formatDate(item.warrantyEnd)}</b>`;
        }

        let replyText = 
          `🛡️ <b>Thông tin Bảo hành Thiết bị</b>\n\n` +
          `• <b>Sản phẩm:</b> ${item.productName}\n` +
          `• <b>Mã Serial:</b> <code>${item.serialNumber}</code>\n` +
          `• <b>Hạn bảo hành:</b> ${formatDate(item.warrantyStart)} - ${formatDate(item.warrantyEnd)}\n` +
          `• <b>Trạng thái:</b> ${statusText}\n\n`;

        if (result.claims && result.claims.length > 0) {
          replyText += `📜 <b>Lịch sử bảo hành / sửa chữa:</b>\n`;
          result.claims.forEach((claim, idx) => {
            const claimStatus = 
              claim.status === "completed" ? "Đã sửa xong" :
              claim.status === "repairing" ? "Đang sửa" :
              claim.status === "inspecting" ? "Đang kiểm tra" :
              claim.status === "pending" ? "Đang chờ" : claim.status;

            replyText += `${idx + 1}. Mã số: <code>${claim.claimNumber}</code>\n` +
                         `  • Lỗi: <i>${claim.issueDescription}</i>\n` +
                         `  • Nhận máy: ${formatDate(claim.receivedDate)}\n` +
                         `  • Trạng thái: <b>${claimStatus}</b>\n\n`;
          });
        } else {
          replyText += `✨ <i>Thiết bị chưa từng phát sinh yêu cầu sửa chữa/bảo hành.</i>\n`;
        }

        await sendTelegramReply(chatId, replyText, messageId);
        return;
      } catch (e: any) {
        console.error("Local warranty query failed:", e);
      }
    } else {
      await sendTelegramReply(
        chatId,
        `⚠️ Bạn muốn kiểm tra bảo hành? Vui lòng cung cấp mã Serial của máy.\nVí dụ: <code>bot ơi bảo hành SN-MACBOOK-001</code>`,
        messageId
      );
      return;
    }
  }

  // 2. Phân tích tài chính (doanh thu, lợi nhuận, tiền lời, chi phí)
  if (
    cleanText.includes("doanh thu") ||
    cleanText.includes("tiền") ||
    cleanText.includes("lợi nhuận") ||
    cleanText.includes("lời") ||
    cleanText.includes("lỗ") ||
    cleanText.includes("chi phí") ||
    cleanText.includes("bán được")
  ) {
    try {
      const fin = await getFinancialReportForBot();
      const formatMoney = (val: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
      };
      
      const finText = 
        `💰 <b>Báo cáo Tài chính Cửa hàng (Cục bộ)</b>\n\n` +
        `📅 <b>Hôm nay:</b>\n` +
        `• Đơn hoàn thành: <code>${fin.today.ordersCount}</code> đơn\n` +
        `• Doanh thu: <b>${formatMoney(fin.today.revenue)}</b>\n` +
        `• Tiền lời (gộp): <b>${formatMoney(fin.today.profit)}</b>\n` +
        `• Chi phí phát sinh: <b>${formatMoney(fin.today.expenses)}</b>\n\n` +
        `📅 <b>Tháng này:</b>\n` +
        `• Đơn hoàn thành: <code>${fin.month.ordersCount}</code> đơn\n` +
        `• Doanh thu: <b>${formatMoney(fin.month.revenue)}</b>\n` +
        `• Tiền lời (gộp): <b>${formatMoney(fin.month.profit)}</b>\n` +
        `• Chi phí vận hành: <b>${formatMoney(fin.month.expenses)}</b>`;
        
      await sendTelegramReply(chatId, finText, messageId);
      return;
    } catch (e: any) {
      console.error("Local financial query failed:", e);
    }
  }

  // 3. Phân tích thống kê kho
  if (
    cleanText.includes("thống kê") || 
    cleanText.includes("tồn kho") || 
    cleanText.includes("kho hàng") ||
    cleanText.includes("báo cáo")
  ) {
    try {
      const stats = await getInventoryStats();
      const inStock = stats.find(s => s.status === "in_stock")?.count || 0;
      const sold = stats.find(s => s.status === "sold")?.count || 0;
      const defective = stats.find(s => s.status === "defective")?.count || 0;
      const warranty = stats.find(s => s.status === "warranty_repair")?.count || 0;
      
      const statsText = 
        `📊 <b>Thống kê Kho hàng (Cục bộ)</b>\n\n` +
        `• <b>Trong kho (Sẵn bán):</b> <code>${inStock}</code> máy\n` +
        `• <b>Đã bán:</b> <code>${sold}</code> máy\n` +
        `• <b>Đang bảo hành:</b> <code>${warranty}</code> máy\n` +
        `• <b>Lỗi/Hỏng:</b> <code>${defective}</code> máy`;
      
      await sendTelegramReply(chatId, statsText, messageId);
      return;
    } catch (e: any) {
      console.error("Local stats query failed:", e);
    }
  }

  // 4. Phân tích tìm kiếm máy
  if (
    cleanText.includes("tìm") || 
    cleanText.includes("kiếm") || 
    cleanText.includes("tra cứu") ||
    cleanText.includes("lục")
  ) {
    let query = text
      .replace(/bot/gi, "")
      .replace(/ơi/gi, "")
      .replace(/tìm kiếm/gi, "")
      .replace(/tìm/gi, "")
      .replace(/kiếm/gi, "")
      .replace(/tra cứu/gi, "")
      .replace(/@TechStoreERPBot/gi, "")
      .replace(/[?,.!]/g, "")
      .trim();

    if (query) {
      try {
        const searchResult = await searchInventoryItems(query);
        if (searchResult.length === 0) {
          await sendTelegramReply(
            chatId, 
            `🔍 Không tìm thấy thiết bị nào khớp với từ khóa <b>"${query}"</b> trong kho.`, 
            messageId
          );
        } else {
          let replyText = `🔍 <b>Kết quả tìm kiếm cho "${query}" (tối đa 5):</b>\n\n`;
          searchResult.forEach((item, idx) => {
            const statusLabel = 
              item.status === "in_stock" ? "Trong kho" : 
              item.status === "sold" ? "Đã bán" : 
              item.status === "defective" ? "Lỗi/Hỏng" :
              item.status === "warranty_repair" ? "Bảo hành" : item.status;
            
            replyText += `${idx + 1}. <b>${item.productName}</b>\n` +
                         `• Serial: <code>${item.serialNumber}</code>\n` +
                         `• Trạng thái: <b>${statusLabel}</b>\n\n`;
          });
          await sendTelegramReply(chatId, replyText, messageId);
        }
        return;
      } catch (e: any) {
        console.error("Local search query failed:", e);
      }
    }
  }

  // 5. Phản hồi mặc định nếu không khớp từ khóa
  const defaultText = 
    `🤖 <b>Hỗ trợ TechStore ERP Bot</b>\n\n` +
    `Bạn có thể sử dụng các cú pháp chat nhanh sau để tương tác với hệ thống:\n` +
    `• Chat: <i>"bot ơi thống kê kho"</i> để xem số liệu kho hàng.\n` +
    `• Chat: <i>"bot ơi tài chính"</i> để xem báo cáo doanh thu, lời lãi.\n` +
    `• Chat: <i>"bot ơi bảo hành SN-MACBOOK-001"</i> để tra cứu hạn bảo hành.\n` +
    `• Chat: <i>"bot ơi tìm MacBook"</i> để tìm nhanh thiết bị.\n\n` +
    `Hoặc sử dụng các lệnh chuẩn:\n` +
    `• <code>/stats</code>: Thống kê nhanh kho hàng.\n` +
    `• <code>/search &lt;từ khóa&gt;</code>: Tìm kiếm thiết bị.`;
  
  await sendTelegramReply(chatId, defaultText, messageId);
}

// Helper gửi phản hồi ngược lại nhóm/chat trên Telegram
async function sendTelegramReply(chatId: string | number, text: string, replyToMessageId?: number) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN is not configured in environment variables");
    return;
  }
  
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_to_message_id: replyToMessageId,
      }),
    });
  } catch (error) {
    console.error("Error sending Telegram reply message:", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Telegram gửi cập nhật qua update.message hoặc update.edited_message
    const message = body.message || body.edited_message;
    if (!message) {
      return NextResponse.json({ success: true, message: "No message payload found in Telegram update" });
    }

    const chatId = message.chat.id;
    const messageId = message.message_id;
    const text = message.text || "";
    const caption = message.caption || "";

    // Xử lý các lệnh điều khiển (Slash Commands) gửi trực tiếp
    if (text.startsWith("/")) {
      const command = text.split(" ")[0].toLowerCase();
      const args = text.substring(command.length).trim();

      if (command === "/start" || command === "/help") {
        const helpText = 
          `🤖 <b>TechStore ERP Bot</b>\n\n` +
          `Các lệnh hỗ trợ:\n` +
          `• <code>/stats</code>: Xem nhanh thống kê kho hàng.\n` +
          `• <code>/search &lt;từ khóa&gt;</code>: Tìm kiếm máy trong kho theo Serial hoặc Tên sản phẩm.\n\n` +
          `👉 <b>Trò chuyện tự nhiên với AI:</b> Gửi tin nhắn chứa từ khóa "bot", "bot ơi" hoặc tag @TechStoreERPBot để đặt câu hỏi tự nhiên về thông tin sản phẩm và kho hàng.\n\n` +
          `👉 <b>Cập nhật ảnh máy (CRUD Update):</b> Gửi hình ảnh/video đính kèm kèm chú thích mã Serial (ví dụ: <code>SN-MACBOOK-001</code>) để tự động lưu tệp đính kèm vào dữ liệu kho hàng.`;
        await sendTelegramReply(chatId, helpText, messageId);
        return NextResponse.json({ success: true, message: "Handled help command" });
      }

      if (command === "/stats") {
        try {
          const inStockResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(inventoryItems)
            .where(eq(inventoryItems.status, "in_stock"));

          const soldResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(inventoryItems)
            .where(eq(inventoryItems.status, "sold"));

          const inStockCount = inStockResult[0]?.count || 0;
          const soldCount = soldResult[0]?.count || 0;

          const statsText = 
            `📊 <b>Thống kê ERP Cửa hàng</b>\n\n` +
            `• <b>Trong kho (sẵn hàng):</b> <code>${inStockCount}</code> máy\n` +
            `• <b>Đã bán thành công:</b> <code>${soldCount}</code> máy\n\n` +
            `Để xem chi tiết đầy đủ, hãy đăng nhập trang quản trị Web ERP.`;
          await sendTelegramReply(chatId, statsText, messageId);
          return NextResponse.json({ success: true, message: "Handled stats command" });
        } catch (e: any) {
          await sendTelegramReply(chatId, `❌ Lỗi khi lấy thống kê: ${e.message}`, messageId);
          return NextResponse.json({ success: false, error: e.message });
        }
      }

      if (command === "/search") {
        if (!args) {
          await sendTelegramReply(chatId, `⚠️ Vui lòng nhập từ khóa tìm kiếm. Ví dụ: <code>/search MacBook</code>`, messageId);
          return NextResponse.json({ success: true, message: "Empty search query" });
        }

        try {
          const searchResult = await db
            .select({
              serialNumber: inventoryItems.serialNumber,
              status: inventoryItems.status,
              productName: products.name,
            })
            .from(inventoryItems)
            .innerJoin(products, eq(inventoryItems.productId, products.id))
            .where(
              or(
                ilike(products.name, `%${args}%`),
                ilike(inventoryItems.serialNumber, `%${args}%`)
              )
            )
            .limit(5);

          if (searchResult.length === 0) {
            await sendTelegramReply(chatId, `🔍 Không tìm thấy thiết bị nào khớp với từ khóa <b>"${args}"</b>.`, messageId);
          } else {
            let replyText = `🔍 <b>Kết quả tìm kiếm cho "${args}" (tối đa 5):</b>\n\n`;
            searchResult.forEach((item, idx) => {
              const statusLabel = item.status === "in_stock" ? "Trong kho" : item.status === "sold" ? "Đã bán" : item.status;
              replyText += `${idx + 1}. <b>${item.productName}</b>\n` +
                           `• Serial: <code>${item.serialNumber}</code>\n` +
                           `• Trạng thái: <b>${statusLabel}</b>\n\n`;
            });
            await sendTelegramReply(chatId, replyText, messageId);
          }
          return NextResponse.json({ success: true, message: "Handled search command" });
        } catch (e: any) {
          await sendTelegramReply(chatId, `❌ Lỗi khi tìm kiếm: ${e.message}`, messageId);
          return NextResponse.json({ success: false, error: e.message });
        }
      }
    }
    
    // Hợp nhất text và caption để quét Regex tìm mã Serial / Báo giá
    const fullText = `${text} ${caption}`.trim();
    
    // Biểu thức Regex quét tìm mã máy Serial (SN-...) và mã Báo giá (QT-...)
    const serialMatch = fullText.match(/SN-[A-Za-z0-9-]+/i);
    const quoteMatch = fullText.match(/QT-[A-Za-z0-9-]+/i);

    const hasPhoto = message.photo && message.photo.length > 0;
    const hasVideo = !!message.video;
    const hasSupportedDocument = message.document && (
      (message.document.mime_type || "").startsWith("image/") || 
      (message.document.mime_type || "").startsWith("video/")
    );
    const hasMedia = hasPhoto || hasVideo || hasSupportedDocument;
    const isMediaSyncFlow = !!hasMedia && (!!serialMatch || !!quoteMatch);

    const isSlashCommand = text.startsWith("/");
    const isStaticCommand = 
      text.startsWith("/start") || 
      text.startsWith("/help") || 
      text.startsWith("/stats") || 
      text.startsWith("/search");

    const hasBotKeywords = 
      fullText.toLowerCase().includes("bot") || 
      fullText.toLowerCase().includes("bot ơi") || 
      fullText.toLowerCase().includes("@techstoreerpbot");

    const isGeminiTriggered = (isSlashCommand && !isStaticCommand) || hasBotKeywords;

    // Nếu không có cả serial/quote và cũng không kích hoạt bot -> Bỏ qua
    if (!serialMatch && !quoteMatch && !isGeminiTriggered) {
      return NextResponse.json({ success: true, message: "Ignored: No serial/quote tags or bot keywords" });
    }

    // Nếu bot được kích hoạt và không phải luồng đồng bộ đa phương tiện (có đính kèm file)
    if (isGeminiTriggered && !isMediaSyncFlow) {
      try {
        await handleLocalKeywordFallback(chatId, text || caption, messageId);
        return NextResponse.json({ success: true, processed: true, mode: "local" });
      } catch (err: any) {
        console.error("Local bot execution error:", err);
        return NextResponse.json({ success: false, error: err.message });
      }
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN environment variable is not defined");
      return NextResponse.json({ success: false, error: "Bot token not configured on server" });
    }


    // 1. Phân loại kiểm tra xem tin nhắn có đính kèm tệp đa phương tiện hay không
    let fileId = "";
    let fileType: "image" | "video" = "image";
    let isUnsupportedDocument = false;
    let unsupportedDocName = "";

    if (message.photo && message.photo.length > 0) {
      // Telegram photo gửi mảng kích thước khác nhau. Lấy phần tử cuối cùng để có độ phân giải gốc cao nhất.
      fileId = message.photo[message.photo.length - 1].file_id;
      fileType = "image";
    } else if (message.video) {
      fileId = message.video.file_id;
      fileType = "video";
    } else if (message.document) {
      // Nhận diện tệp đính kèm không nén (được gửi dưới dạng File/Document)
      const mime = message.document.mime_type || "";
      if (mime.startsWith("image/") || mime.startsWith("video/")) {
        fileId = message.document.file_id;
        fileType = mime.startsWith("image/") ? "image" : "video";
      } else {
        isUnsupportedDocument = true;
        unsupportedDocName = message.document.file_name || "không rõ tên tệp";
      }
    }

    // Nếu người dùng nhắn cú pháp tag máy nhưng gửi kèm tệp văn bản khác (PDF, zip...)
    if (isUnsupportedDocument) {
      await sendTelegramReply(
        chatId,
        `⚠️ Tệp đính kèm <b>${unsupportedDocName}</b> không phải định dạng hình ảnh hoặc video được hỗ trợ. Vui lòng gửi ảnh hoặc video gốc.`,
        messageId
      );
      return NextResponse.json({ success: true, message: "Rejected: Unsupported document format" });
    }

    // Nếu người dùng nhắn cú pháp tag máy nhưng KHÔNG đính kèm bất kỳ tệp hình ảnh/video nào
    if (!fileId) {
      await sendTelegramReply(
        chatId,
        `⚠️ <b>Phát hiện mã cấu hình:</b>\n` +
        `${serialMatch ? `• Serial: <code>${serialMatch[0]}</code>\n` : ""}` +
        `${quoteMatch ? `• Báo giá: <code>${quoteMatch[0]}</code>\n` : ""}` +
        `Nhưng không tìm thấy hình ảnh hoặc video nào đính kèm.\n\n` +
        `👉 <b>Cách gửi:</b> Vui lòng gửi hình ảnh/video trực tiếp (hoặc gửi file gốc) và ghi mã số tương ứng vào phần <b>"Thêm chú thích" (Add caption)</b> trước khi bấm gửi.`,
        messageId
      );
      return NextResponse.json({ success: true, message: "Prompted user to attach media" });
    }

    // 2. Gọi Telegram API lấy thông tin file_path thực tế để tạo link trực tiếp
    const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const fileRes = await fetch(getFileUrl);
    if (!fileRes.ok) {
      await sendTelegramReply(
        chatId,
        `❌ Lỗi kết nối đến Telegram API để giải quyết đường dẫn ảnh/video.`,
        messageId
      );
      return NextResponse.json({ success: false, error: "Failed to query Telegram getFile" });
    }

    const fileJson = await fileRes.json();
    if (!fileJson.ok || !fileJson.result?.file_path) {
      await sendTelegramReply(
        chatId,
        `❌ Máy chủ Telegram không phản hồi đường dẫn tệp gốc cho file này.`,
        messageId
      );
      return NextResponse.json({ success: false, error: "Empty file_path returned by Telegram" });
    }

    const filePath = fileJson.result.file_path;
    // URL trực tiếp không hết hạn truy cập tải ảnh từ máy chủ Telegram
    const directDownloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    // 3. Tiến hành kiểm tra và lưu vào CSDL
    let successCount = 0;

    // A. Xử lý đồng bộ theo số Serial laptop (SN-...)
    if (serialMatch) {
      const serialNum = serialMatch[0].toUpperCase();
      
      const itemQuery = await db
        .select({
          id: inventoryItems.id,
          serialNumber: inventoryItems.serialNumber,
          images: inventoryItems.images,
          productName: products.name,
        })
        .from(inventoryItems)
        .innerJoin(products, eq(inventoryItems.productId, products.id))
        .where(
          or(
            eq(inventoryItems.serialNumber, serialNum),
            eq(inventoryItems.serialNumber, serialNum.toLowerCase())
          )
        )
        .limit(1);

      if (itemQuery.length === 0) {
        await sendTelegramReply(
          chatId,
          `❌ Không tìm thấy thiết bị nào có Serial <b>${serialNum}</b> trên hệ thống ERP của cửa hàng.`,
          messageId
        );
      } else {
        const item = itemQuery[0];
        const currentImages = item.images || [];
        // Append URL tải trực tiếp vào mảng ảnh nhập kho của máy
        const updatedImages = [...currentImages, directDownloadUrl];
        
        await db
          .update(inventoryItems)
          .set({
            images: updatedImages,
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, item.id));

        successCount++;
        await sendTelegramReply(
          chatId,
          `✅ <b>Đồng bộ Nhập kho thành công!</b>\n` +
          `• <b>Thiết bị:</b> ${item.productName}\n` +
          `• <b>Serial:</b> <code>${item.serialNumber}</code>\n` +
          `• <b>Trạng thái:</b> Đã đính kèm tệp (${fileType === "image" ? "Ảnh" : "Video"} gốc không bị nén) thành công vào ERP.\n\n` +
          `<a href="${directDownloadUrl}">🖼️ Nhấp vào đây để xem tệp gốc</a>`,
          messageId
        );
      }
    }

    // B. Xử lý đồng bộ theo mã Báo giá (QT-...)
    if (quoteMatch) {
      const quoteNum = quoteMatch[0].toUpperCase();
      
      const quoteQuery = await db
        .select({
          id: quotations.id,
          quoteNumber: quotations.quoteNumber,
          customerName: quotations.customerName,
          shareToken: quotations.shareToken,
        })
        .from(quotations)
        .where(
          or(
            eq(quotations.quoteNumber, quoteNum),
            eq(quotations.quoteNumber, quoteNum.toLowerCase())
          )
        )
        .limit(1);

      if (quoteQuery.length === 0) {
        await sendTelegramReply(
          chatId,
          `❌ Không tìm thấy Báo giá điện tử có mã <b>${quoteNum}</b> trên hệ thống ERP.`,
          messageId
        );
      } else {
        const quote = quoteQuery[0];
        
        // Truy vấn tất cả sản phẩm thuộc báo giá
        const qItems = await db
          .select()
          .from(quotationItems)
          .where(eq(quotationItems.quotationId, quote.id));

        if (qItems.length === 0) {
          await sendTelegramReply(
            chatId,
            `❌ Báo giá <b>${quote.quoteNumber}</b> chưa có bất kỳ sản phẩm nào để gán ảnh/video.`,
            messageId
          );
        } else {
          // Lưu tệp đa phương tiện vào sản phẩm đầu tiên của báo giá để hiển thị trên Carousel trang public
          const firstItem = qItems[0];
          const existingNotes = firstItem.notes || "";
          let newNotes = "";

          if (existingNotes.includes(" ||media: ")) {
            const parts = existingNotes.split(" ||media: ");
            const textPart = parts[0];
            const mediaPart = parts[1] ? `${parts[1]}, ${directDownloadUrl}` : directDownloadUrl;
            newNotes = `${textPart} ||media: ${mediaPart}`;
          } else {
            newNotes = `${existingNotes.trim()} ||media: ${directDownloadUrl}`.trim();
          }

          await db
            .update(quotationItems)
            .set({ notes: newNotes })
            .where(eq(quotationItems.id, firstItem.id));

          successCount++;
          
          // Tạo đường dẫn chia sẻ báo giá
          const hostUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
          const shareLink = `${hostUrl}/quotations/share/${quote.shareToken}`;

          await sendTelegramReply(
            chatId,
            `✅ <b>Đồng bộ Báo giá thành công!</b>\n` +
            `• <b>Mã báo giá:</b> <code>${quote.quoteNumber}</code>\n` +
            `• <b>Khách hàng:</b> ${quote.customerName || "Khách hàng lẻ"}\n` +
            `• <b>Trạng thái:</b> Tệp đa phương tiện gốc đã được tải và cập nhật tự động lên trang công khai của khách.\n\n` +
            `🔗 <a href="${shareLink}">Nhấp vào đây để xem trực tiếp báo giá của khách</a>`,
            messageId
          );
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: true, 
      successCount 
    });

  } catch (error: any) {
    console.error("Critical error in Telegram Webhook handler:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Internal Server Error in Webhook" 
    }, { status: 500 });
  }
}
