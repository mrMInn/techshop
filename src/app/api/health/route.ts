import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      DATABASE_URL_PREFIX: process.env.DATABASE_URL?.substring(0, 40) + "...",
      SUPABASE_URL_SET: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY_SET: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
  };

  // Test 1: Database connection via Drizzle
  try {
    const start = Date.now();
    const dbResult = await db.execute(sql`SELECT 1 as connected`);
    results.database = {
      status: "OK",
      latency: `${Date.now() - start}ms`,
      result: dbResult,
    };
  } catch (err: any) {
    results.database = {
      status: "ERROR",
      error: err.message || String(err),
      code: err.code,
    };
  }

  // Test 2: Supabase Auth
  try {
    const start = Date.now();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    results.supabaseAuth = {
      status: error ? "ERROR" : "OK",
      latency: `${Date.now() - start}ms`,
      hasUser: !!data?.user,
      userId: data?.user?.id?.substring(0, 8) + "...",
      error: error?.message,
    };
  } catch (err: any) {
    results.supabaseAuth = {
      status: "ERROR",
      error: err.message || String(err),
    };
  }

  // Test 3: Query profiles table
  try {
    const start = Date.now();
    const profilesResult = await db.execute(sql`SELECT count(*) as count FROM profiles`);
    results.profilesQuery = {
      status: "OK",
      latency: `${Date.now() - start}ms`,
      result: profilesResult,
    };
  } catch (err: any) {
    results.profilesQuery = {
      status: "ERROR",
      error: err.message || String(err),
      code: err.code,
    };
  }

  return NextResponse.json(results, { status: 200 });
}
