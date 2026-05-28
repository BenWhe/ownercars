import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ADVERT_STATUS, nextConfirmationDueDate } from "@/lib/adverts/lifecycle";

type Action = "pause" | "reactivate" | "sold";

function targetForAction(action: Action) {
  switch (action) {
    case "pause":
      return ADVERT_STATUS.PAUSED;
    case "reactivate":
      return ADVERT_STATUS.PUBLISHED;
    case "sold":
      return ADVERT_STATUS.SOLD;
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
  }

  const { id } = await context.params;
  let action: Action;

  try {
    const body = await req.json();
    action = body.action;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!id || !["pause", "reactivate", "sold"].includes(action)) {
    return NextResponse.json({ error: "Invalid lifecycle action" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const targetStatus = targetForAction(action);
  const now = new Date().toISOString();

  const update: Record<string, string | null> = {
    status: targetStatus,
    updated_at: now,
  };

  if (targetStatus === ADVERT_STATUS.PUBLISHED) {
    update.published_at = now;
    update.last_availability_confirmed_at = now;
    update.next_availability_check_at = nextConfirmationDueDate(new Date(now));
    update.availability_reminder_sent_at = null;
    update.availability_pause_due_at = null;
    update.availability_confirmation_token = null;
  }

  if (targetStatus === ADVERT_STATUS.PAUSED) {
    update.paused_at = now;
  }

  if (targetStatus === ADVERT_STATUS.SOLD) {
    update.sold_at = now;
    update.availability_confirmation_token = null;
    update.next_availability_check_at = null;
    update.availability_reminder_sent_at = null;
    update.availability_pause_due_at = null;
  }

  const { data, error } = await supabaseAdmin
    .from("adverts")
    .update(update)
    .eq("id", id)
    .eq("seller_id", user.id)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Not authorised to manage this advert." },
      { status: 403 }
    );
  }

  return NextResponse.json({ advert: data });
}
