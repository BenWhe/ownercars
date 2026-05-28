import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ADVERT_STATUS, nextConfirmationDueDate } from "@/lib/adverts/lifecycle";

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
  }

  const token = new URL(req.url).searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/adverts/reconfirm?status=missing", req.url));
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("adverts")
    .update({
      status: ADVERT_STATUS.PUBLISHED,
      last_availability_confirmed_at: now,
      next_availability_check_at: nextConfirmationDueDate(new Date(now)),
      availability_confirmation_token: null,
      availability_reminder_sent_at: null,
      availability_pause_due_at: null,
      paused_at: null,
      updated_at: now,
    })
    .eq("availability_confirmation_token", token)
    .in("status", [ADVERT_STATUS.PUBLISHED, ADVERT_STATUS.PAUSED])
    .select("id")
    .maybeSingle();

  if (error) {
    const url = new URL("/adverts/reconfirm", req.url);
    url.searchParams.set("status", "error");
    return NextResponse.redirect(url);
  }

  const url = new URL("/adverts/reconfirm", req.url);
  url.searchParams.set("status", data ? "confirmed" : "invalid");
  return NextResponse.redirect(url);
}
