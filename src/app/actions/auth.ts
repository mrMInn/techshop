"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

/**
 * Server Action to handle user login via email and password
 */
export async function loginAction(formData: Record<string, string>) {
  const email = formData.email?.trim();
  const password = formData.password;

  if (!email || !password) {
    return { success: false, message: "Vui lòng nhập đầy đủ email và mật khẩu." };
  }

  try {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    if (!data.user) {
      return { success: false, message: "Đăng nhập thất bại. Vui lòng thử lại." };
    }

    // Check if profile is active
    const userProfile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, data.user.id))
      .limit(1);

    if (userProfile.length > 0 && !userProfile[0].isActive) {
      // Sign out immediately if user is disabled
      await supabase.auth.signOut();
      return { success: false, message: "Tài khoản của bạn đã bị khóa." };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Lỗi đăng nhập:", error);
    return { success: false, message: error.message || "Đăng nhập thất bại do lỗi hệ thống." };
  }
}

/**
 * Server Action to sign out the current user
 */
export async function logoutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { success: true };
  } catch (error) {
    console.error("Lỗi đăng xuất:", error);
    return { success: false, error: "Đăng xuất thất bại do lỗi hệ thống." };
  }
}


/**
 * Server Action to retrieve the current user and their profile/roles
 */
export async function getCurrentUserAction() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { success: false, user: null, profile: null };
    }

    const userProfile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (userProfile.length === 0) {
      // If profile doesn't exist yet, return auth user with fallback role
      return {
        success: true,
        user,
        profile: {
          id: user.id,
          fullName: user.email?.split("@")[0] || "User",
          email: user.email || "",
          role: "staff" as const,
          isActive: true,
        },
      };
    }

    return {
      success: true,
      user,
      profile: userProfile[0],
    };
  } catch (error) {
    console.error("Lỗi lấy thông tin người dùng hiện tại:", error);
    return { success: false, user: null, profile: null };
  }
}
