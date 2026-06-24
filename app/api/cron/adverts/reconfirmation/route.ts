import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ADVERT_STATUS,
  pauseDueDate,
  reminderDueDate,
} from "@/lib/adverts/lifecycle";
import { sendReconfirmationEmail } from "@/lib/email/reconfirmation";

function cronAuthorised(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

function baseUrl(req: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
}

function confirmationUrl(req: Request, token: string) {
  return `${baseUrl(req)}/api/adverts/reconfirm?token=${encodeURIComponent(token)}`;
}

export async function GET(req: Request) {
  if (!cronAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date();
  const nowIso = now.toISOString();
  const result = {
    checksSent: 0,
    remindersSent: 0,
    paused: 0,
    errors: [] as string[],
  };

  const { data: dueChecks, error: dueChecksError } = await supabaseAdmin
    .from("adverts")
    .select("id, title, seller_email")
    .eq("status", ADVERT_STATUS.PUBLISHED)
    .lte("next_availability_check_at", nowIso)
    .is("availability_confirmation_token", null)
    .not("seller_email", "is", null)
    .limit(50);

  if (dueChecksError) {
    return NextResponse.json({ error: dueChecksError.message }, { status: 500 });
  }

  for (const advert of dueChecks || []) {
    try {
      const token = crypto.randomUUID();
      await sendReconfirmationEmail({
        to: advert.seller_email,
        subject: "Is your OwnerCars advert still available?",
        advertTitle: advert.title || "OwnerCars advert",
        confirmationUrl: confirmationUrl(req, token),
      });

      const { error } = await supabaseAdmin
        .from("adverts")
        .update({
          availability_confirmation_token: token,
          availability_check_sent_at: nowIso,
          availability_reminder_due_at: reminderDueDate(now),
          updated_at: nowIso,
        })
        .eq("id", advert.id)
        .eq("status", ADVERT_STATUS.PUBLISHED)
        .is("availability_confirmation_token", null);

      if (error) throw error;
      result.checksSent += 1;
    } catch (error) {
      result.errors.push(
        `check ${advert.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const { data: dueReminders, error: dueRemindersError } = await supabaseAdmin
    .from("adverts")
    .select("id, title, seller_email, availability_confirmation_token")
    .eq("status", ADVERT_STATUS.PUBLISHED)
    .lte("availability_reminder_due_at", nowIso)
    .is("availability_reminder_sent_at", null)
    .not("availability_confirmation_token", "is", null)
    .not("seller_email", "is", null)
    .limit(50);

  if (dueRemindersError) {
    return NextResponse.json({ error: dueRemindersError.message }, { status: 500 });
  }

  for (const advert of dueReminders || []) {
    try {
      await sendReconfirmationEmail({
        to: advert.seller_email,
        subject: "Reminder: confirm your OwnerCars advert is still available",
        advertTitle: advert.title || "OwnerCars advert",
        confirmationUrl: confirmationUrl(req, advert.availability_confirmation_token),
        reminder: true,
      });

      const { error } = await supabaseAdmin
        .from("adverts")
        .update({
          availability_reminder_sent_at: nowIso,
          availability_pause_due_at: pauseDueDate(now),
          updated_at: nowIso,
        })
        .eq("id", advert.id)
        .eq("status", ADVERT_STATUS.PUBLISHED)
        .is("availability_reminder_sent_at", null);

      if (error) throw error;
      result.remindersSent += 1;
    } catch (error) {
      result.errors.push(
        `reminder ${advert.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const { data: duePauses, error: duePausesError } = await supabaseAdmin
    .from("adverts")
    .select("id")
    .eq("status", ADVERT_STATUS.PUBLISHED)
    .lte("availability_pause_due_at", nowIso)
    .not("availability_confirmation_token", "is", null)
    .limit(100);

  if (duePausesError) {
    return NextResponse.json({ error: duePausesError.message }, { status: 500 });
  }

  for (const advert of duePauses || []) {
    const { error } = await supabaseAdmin
      .from("adverts")
      .update({
        status: ADVERT_STATUS.PAUSED,
        paused_at: nowIso,
        availability_confirmation_token: null,
        updated_at: nowIso,
      })
      .eq("id", advert.id)
      .eq("status", ADVERT_STATUS.PUBLISHED);

    if (error) {
      result.errors.push(`pause ${advert.id}: ${error.message}`);
    } else {
      result.paused += 1;
    }
  }

  const status = result.errors.length ? 207 : 200;
  return NextResponse.json(result, { status });
}
