import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { auditLogs, profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendAuditEmailNotification } from "@/lib/mail/email-service";

/**
 * Ghi nhận nhật ký hệ thống (Audit Log) và kích hoạt cảnh báo qua email ngầm (Asynchronous)
 * 
 * @param action Thao tác thực hiện: 'CREATE', 'UPDATE', 'DELETE'
 * @param tableName Tên bảng dữ liệu chịu tác động (ví dụ: 'orders', 'inventory_items')
 * @param recordId ID (uuid hoặc string) của bản ghi bị tác động
 * @param oldData Dữ liệu cũ trước khi thao tác (chỉ dùng cho UPDATE và DELETE)
 * @param newData Dữ liệu mới sau khi thao tác (chỉ dùng cho CREATE và UPDATE)
 * @param tx Drizzle Transaction runner (nếu nằm trong một transaction, truyền vào để chạy cùng)
 */
export async function logAndNotify(
  action: "CREATE" | "UPDATE" | "DELETE",
  tableName: string,
  recordId: string,
  oldData: any,
  newData: any,
  tx?: any
) {
  try {
    const runner = tx || db;
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userFullName: string | null = null;

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = user.email || null;
        
        // Lấy họ tên hiển thị của người dùng từ bảng profiles
        const profile = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
        if (profile.length > 0) {
          userFullName = profile[0].fullName;
        } else {
          userFullName = user.email?.split("@")[0] || "Người dùng";
        }
      }
    } catch (err) {
      console.warn("Không lấy được session đăng nhập hiện tại cho nhật ký (có thể chạy ngầm/seeding):", err);
    }

    // 1. Ghi nhận log vào PostgreSQL (audit_logs table)
    await runner.insert(auditLogs).values({
      userId,
      action,
      tableName,
      recordId,
      oldData,
      newData,
      createdAt: new Date(),
    });

    // 2. Kích hoạt gửi email cảnh báo bất đồng bộ (non-blocking) ở background
    // Việc này giúp luồng nghiệp vụ của người dùng diễn ra trơn tru, không bị chờ đợi SMTP phản hồi.
    sendAuditEmailNotification({
      userId,
      userEmail,
      userFullName,
      action,
      tableName,
      recordId,
      oldData,
      newData,
    }).catch(err => {
      console.error("Lỗi khi chạy ngầm gửi email cảnh báo hoạt động:", err);
    });

  } catch (err) {
    console.error("Thất bại khi ghi nhận nhật ký hệ thống (Audit Log):", err);
  }
}
