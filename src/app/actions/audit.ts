"use server";

import { db } from "@/lib/db";
import { auditLogs, profiles } from "@/lib/db/schema";
import { eq, like, and, desc, sql, or } from "drizzle-orm";
import { getCurrentUserAction } from "./auth";

/**
 * Lấy danh sách nhật ký hệ thống (Audit Logs) phân trang và lọc theo yêu cầu
 */
export async function getAuditLogsAction(filters: {
  page?: number;
  limit?: number;
  search?: string;
  tableName?: string;
  action?: string;
}) {
  const user = await getCurrentUserAction();
  if (!user.success || user.profile?.role !== "admin") {
    return { success: false, message: "Không có quyền truy cập nhật ký hệ thống.", data: [], total: 0 };
  }

  try {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    let conditions: any[] = [];

    if (filters.action && filters.action !== "all") {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    
    if (filters.tableName && filters.tableName !== "all") {
      conditions.push(eq(auditLogs.tableName, filters.tableName));
    }

    if (filters.search) {
      const searchPattern = `%${filters.search.toLowerCase()}%`;
      const searchLower = filters.search.trim().toLowerCase();
      
      const orConditions = [
        like(sql`lower(${auditLogs.tableName})`, searchPattern),
        like(sql`lower(${auditLogs.action})`, searchPattern),
        like(sql`lower(${profiles.fullName})`, searchPattern),
        like(sql`lower(${profiles.email})`, searchPattern)
      ];

      // Hỗ trợ tìm kiếm các log của hệ thống/tác vụ ẩn (userId is null)
      if (
        searchLower.includes("hệ thống") || 
        searchLower.includes("he thong") || 
        searchLower.includes("tác vụ") || 
        searchLower.includes("tac vu") ||
        searchLower.includes("ẩn") ||
        searchLower.includes("an") ||
        searchLower.includes("n/a") ||
        searchLower === "na"
      ) {
        orConditions.push(sql`${auditLogs.userId} IS NULL`);
      }

      conditions.push(or(...orConditions));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Truy vấn nhật ký kèm thông tin họ tên, email của người thực hiện
    const data = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        tableName: auditLogs.tableName,
        recordId: auditLogs.recordId,
        oldData: auditLogs.oldData,
        newData: auditLogs.newData,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        userFullName: profiles.fullName,
        userEmail: profiles.email,
      })
      .from(auditLogs)
      .leftJoin(profiles, eq(auditLogs.userId, profiles.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Tính tổng số bản ghi phục vụ phân trang
    const totalRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .leftJoin(profiles, eq(auditLogs.userId, profiles.id))
      .where(whereClause);

    const total = Number(totalRes[0]?.count || 0);

    return {
      success: true,
      data,
      total,
      page,
      limit,
    };
  } catch (error: any) {
    console.error("Lỗi khi truy vấn nhật ký hệ thống:", error);
    return { success: false, message: "Lỗi hệ thống: " + error.message, data: [], total: 0 };
  }
}
