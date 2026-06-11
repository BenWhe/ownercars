import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return new NextResponse("Server configuration error.", { status: 500 });
  }

  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return new NextResponse("Missing token.", { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await admin.from("search_alerts").delete().eq("token", token);

  const base = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f6f9;margin:0;padding:0`;
  const card = `max-width:480px;margin:80px auto;padding:40px 32px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);text-align:center`;
  const h = `font-size:20px;font-weight:700;color:#111827;margin:0 0 12px`;
  const p = `font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6`;
  const a = `display:inline-block;background:#2563EB;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px`;

  const html = error
    ? `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>OwnerCars</title></head><body style="${base}"><div style="${card}"><h2 style="${h}">Something went wrong</h2><p style="${p}">We couldn't find that alert. It may have already been removed.</p><a href="https://www.ownercars.co.uk/browse" style="${a}">Back to Browse</a></div></body></html>`
    : `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Unsubscribed — OwnerCars</title></head><body style="${base}"><div style="${card}"><h2 style="${h}">You're unsubscribed</h2><p style="${p}">Your search alert has been removed. You won't receive any more notifications from this alert.</p><a href="https://www.ownercars.co.uk/browse" style="${a}">Back to Browse</a></div></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}
