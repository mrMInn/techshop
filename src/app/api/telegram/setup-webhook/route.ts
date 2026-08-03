import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { telegramSettings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Lấy token bot Telegram từ env hoặc db
    const envBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const settingsList = await db.select().from(telegramSettings).limit(1);
    const botToken = envBotToken || settingsList[0]?.botToken;

    if (!botToken) {
      return new NextResponse(
        "❌ Thất bại: Chưa khai báo TELEGRAM_BOT_TOKEN trong .env.local hoặc cơ sở dữ liệu.",
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // 2. Tự động nhận diện host hiện tại của client
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";

    // Nếu host là localhost hoặc 127.0.0.1, Telegram không thể kết nối tới
    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      return new NextResponse(
        `<html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 50px 20px; background: #f5f5f7; color: #1d1d1f; line-height: 1.6;">
            <div style="max-width: 550px; margin: 0 auto; background: white; padding: 40px; border-radius: 24px; border: 1px solid #e3e3e8; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
              <h2 style="color: #ff3b30; margin-top: 0; font-size: 20px; font-weight: 800;">⚠️ Không thể đăng ký từ Localhost</h2>
              <p style="font-size: 14px; color: #48484a; font-weight: 500;">
                Telegram yêu cầu một đường dẫn bảo mật bắt đầu bằng <b>https://</b> để có thể chuyển tiếp tin nhắn. Địa chỉ nội bộ <code>${host}</code> không thể truy cập từ internet.
              </p>
              
              <div style="background: #fff8f8; border: 1px solid #ffcccc; padding: 16px; border-radius: 16px; margin: 20px 0; font-size: 13.5px; color: #d12222; font-weight: 600;">
                <b>Lỗi xảy ra:</b> An HTTPS URL must be provided for webhook.
              </div>

              <p style="font-weight: 700; font-size: 14px; margin-bottom: 8px; color: #1d1d1f;">Cách xử lý:</p>
              <ol style="padding-left: 20px; font-size: 13.5px; color: #48484a; font-weight: 500; line-height: 1.8;">
                <li>Hãy mở liên kết web của bạn bằng <b>đường dẫn public (Preview URL)</b> của IDE đang chạy dự án này (dạng <code>https://xxx.serveousercontent.com</code>).</li>
                <li>Vào lại mục <b>Cài đặt ➔ Thông báo Bot</b> từ tên miền HTTPS đó.</li>
                <li>Bấm lại nút <b>"Kích hoạt AI Bot"</b> để hệ thống tự động thiết lập chính xác.</li>
              </ol>
            </div>
          </body>
        </html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Đối với các tên miền public (serveousercontent, ngrok), ép buộc sử dụng HTTPS vì Telegram yêu cầu bảo mật
    const webhookUrl = `https://${host}/api/telegram/webhook`;

    // 3. Gọi Telegram API để thiết lập webhook
    const telegramUrl = `https://api.telegram.org/bot${botToken.trim()}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
    const response = await fetch(telegramUrl);
    const data = await response.json();

    if (data.ok) {
      return new NextResponse(
        `<html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 50px 20px; background: #f5f5f7; color: #1d1d1f;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 24px; border: 1px solid #e3e3e8; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
              <h1 style="color: #34c759; margin-bottom: 16px; font-size: 24px; font-weight: 800;">🎉 Kích hoạt thành công!</h1>
              <p style="font-size: 14px; line-height: 1.6; color: #48484a; font-weight: 500;">
                Hệ thống đã tự động đăng ký liên kết AI Bot Telegram của bạn thành công.
              </p>
              <div style="background: #f5f5f7; padding: 16px; border-radius: 16px; font-family: monospace; font-size: 12.5px; text-align: left; margin: 24px 0; word-break: break-all; border: 1px solid #e0e0e0; color: #1d1d1f; font-weight: 600; line-height: 1.5;">
                <span style="color: #8e8e93; font-size: 10px; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 4px;">WEBHOOK ENDPOINT:</span>
                ${webhookUrl}
              </div>
              <p style="font-size: 13px; color: #7a7a7a; font-weight: 500; margin-top: 20px; line-height: 1.5;">
                Bây giờ, bạn đã có thể chat riêng hoặc gõ <b>"bot ơi"</b> trong nhóm Telegram để bắt đầu tương tác với trí tuệ nhân tạo (Gemini AI) có dữ liệu thực tế từ cửa hàng của bạn.
              </p>
            </div>
          </body>
        </html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    } else {
      return new NextResponse(
        `❌ Thất bại khi đăng ký webhook với Telegram: ${data.description || "Lỗi không xác định"}`,
        { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
  } catch (error: any) {
    return new NextResponse(`❌ Lỗi hệ thống: ${error.message}`, { status: 500 });
  }
}
