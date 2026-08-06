import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      DATABASE_URL_PREVIEW: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'),
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  // Test 1: Database via Drizzle
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
      message: err.message || String(err),
      code: err.code,
      cause: err.cause ? String(err.cause) : undefined,
    };
  }

  // Test 2: Query profiles
  try {
    const start = Date.now();
    const profilesResult = await db.execute(sql`SELECT count(*) as count FROM profiles`);
    results.profiles = {
      status: "OK",
      latency: `${Date.now() - start}ms`,
      result: profilesResult,
    };
  } catch (err: any) {
    results.profiles = {
      status: "ERROR",
      message: err.message || String(err),
    };
  }

  // Test 3: Supabase Auth
  try {
    const start = Date.now();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    results.auth = {
      status: error ? "ERROR" : "OK",
      latency: `${Date.now() - start}ms`,
      hasUser: !!data?.user,
      userId: data?.user?.id?.substring(0, 8) + "...",
    };
  } catch (err: any) {
    results.auth = { status: "ERROR", error: err.message };
  }

  return NextResponse.json(results, { status: 200 });
}
