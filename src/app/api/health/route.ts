import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      DATABASE_URL_PREVIEW: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'),
      SUPABASE_URL_SET: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY_SET: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  // Test 1: Database connection via Drizzle (existing config)
  try {
    const start = Date.now();
    const dbResult = await db.execute(sql`SELECT 1 as connected`);
    results.drizzle = {
      status: "OK",
      latency: `${Date.now() - start}ms`,
      result: dbResult,
    };
  } catch (err: any) {
    results.drizzle = {
      status: "ERROR",
      latency: "N/A",
      message: err.message || String(err),
      code: err.code,
      severity: err.severity,
      detail: err.detail,
      hint: err.hint,
      routine: err.routine,
      errno: err.errno,
      syscall: err.syscall,
      cause: err.cause ? String(err.cause) : undefined,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    };
  }

  // Test 2: Fresh direct postgres connection with SSL
  const dbUrl = process.env.DATABASE_URL!;
  try {
    const start = Date.now();
    const freshSql = postgres(dbUrl, {
      prepare: false,
      max: 1,
      connect_timeout: 8,
      idle_timeout: 5,
      ssl: "require",
    });
    const freshResult = await freshSql`SELECT 1 as connected`;
    await freshSql.end();
    results.freshDirect = {
      status: "OK",
      latency: `${Date.now() - start}ms`,
      result: freshResult,
    };
  } catch (err: any) {
    results.freshDirect = {
      status: "ERROR",
      message: err.message || String(err),
      code: err.code,
      severity: err.severity,
      errno: err.errno,
      syscall: err.syscall,
    };
  }

  // Test 3: Try via Supabase Pooler (Transaction mode, port 6543)
  const poolerUrl = dbUrl
    .replace(/@db\./, "@aws-1-ap-southeast-1.pooler.supabase.com:")
    .replace(/:5432\//, ':6543/')
    .replace(/postgres:/, 'postgres.zhmvryzknkqitnyqmimc:');
  try {
    const start = Date.now();
    const poolerSql = postgres(poolerUrl, {
      prepare: false,
      max: 1,
      connect_timeout: 8,
      idle_timeout: 5,
    });
    const poolerResult = await poolerSql`SELECT 1 as connected`;
    await poolerSql.end();
    results.pooler = {
      status: "OK",
      latency: `${Date.now() - start}ms`,
      result: poolerResult,
      url_preview: poolerUrl.replace(/:[^:@]+@/, ':***@'),
    };
  } catch (err: any) {
    results.pooler = {
      status: "ERROR",
      message: err.message || String(err),
      code: err.code,
      url_preview: poolerUrl.replace(/:[^:@]+@/, ':***@'),
    };
  }

  // Test 4: Supabase Auth
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

  return NextResponse.json(results, { status: 200 });
}
