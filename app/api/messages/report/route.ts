import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/messages/send";
import { notifyAdminOfReport, REPORT_REASONS, type ReportReason } from "@/lib/messages/reports";

/**
 * POST /api/messages/report  { messageId, reason }
 *
 * The recipient of a delivered message reports it. The report goes to the
 * security dashboard and is emailed to the admin address, and the sender's
 * future messages are held for review again (trust back to "new") until
 * the report has been looked at.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createAdminClient();
  if (!url || !anonKey || !admin) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { messageId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const reason = body.reason as ReportReason;
  if (!body.messageId || !(reason in REPORT_REASONS)) {
    return NextResponse.json({ error: "Please choose a reason." }, { status: 400 });
  }

  const { data: msg } = await admin
    .from("messages")
    .select("id, sender_id, recipient_id, status")
    .eq("id", body.messageId)
    .maybeSingle();
  // Only the person who received a delivered message can report it.
  if (!msg || msg.recipient_id !== user.id || msg.status !== "delivered") {
    return NextResponse.json({ error: "You can't report this message." }, { status: 403 });
  }

  const { error } = await admin.from("message_reports").upsert(
    { message_id: msg.id, reporter_id: user.id, reported_user_id: msg.sender_id, reason },
    { onConflict: "message_id,reporter_id", ignoreDuplicates: true }
  );
  if (error) return NextResponse.json({ error: "Could not send your report." }, { status: 400 });

  // Until someone has looked at it, the reported account's messages are
  // held for review again. A suspended account stays suspended.
  const { data: trust } = await admin.from("account_trust").select("status").eq("user_id", msg.sender_id).maybeSingle();
  if (trust?.status !== "suspended") {
    await admin.from("account_trust").upsert(
      { user_id: msg.sender_id, status: "new", updated_at: new Date().toISOString(), note: "Reported by a seller" },
      { onConflict: "user_id" }
    );
  }

  await notifyAdminOfReport(admin, msg.id, reason);
  return NextResponse.json({ ok: true });
}
