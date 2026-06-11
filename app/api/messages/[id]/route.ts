import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { messageThreadId, parseMessageThreadId } from "@/lib/messages/thread";

type Context = { params: Promise<{ id: string }> };

function createSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return null;

  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });
}

export async function GET(req: NextRequest, context: Context) {
  const { id } = await context.params;
  const thread = parseMessageThreadId(id);

  if (!thread) {
    return NextResponse.json({ error: "Invalid message thread." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  if (!supabase) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { advertId, otherUserId } = thread;

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .eq("advert_id", advertId)
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
    .order("created_at", { ascending: true });

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 400 });
  }

  const hasThreadAccess = (messages || []).length > 0;

  if (!hasThreadAccess) {
    return NextResponse.json({ error: "Not authorised to view this conversation." }, { status: 403 });
  }

  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id, year, make, model, price, seller_id")
    .eq("id", advertId)
    .maybeSingle();

  if (advertError) {
    return NextResponse.json({ error: advertError.message }, { status: 400 });
  }

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("advert_id", advertId)
    .eq("sender_id", otherUserId)
    .eq("recipient_id", user.id)
    .is("read_at", null);

  return NextResponse.json({
    conversation: {
      id,
      advert_id: advertId,
      other_user_id: otherUserId,
      adverts: advert,
      status: "open",
    },
    messages: messages || [],
    userId: user.id,
  });
}

export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const thread = parseMessageThreadId(id);

  if (!thread) {
    return NextResponse.json({ error: "Invalid message thread." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  if (!supabase) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let payload: { body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const body = payload.body?.trim();
  if (!body) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }

  const { advertId, otherUserId } = thread;

  const { data: existing, error: existingError } = await supabase
    .from("messages")
    .select("id")
    .eq("advert_id", advertId)
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
    .limit(1);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  if (!existing?.length) {
    return NextResponse.json({ error: "Not authorised to reply to this conversation." }, { status: 403 });
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      advert_id: advertId,
      sender_id: user.id,
      recipient_id: otherUserId,
      body,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Notify the recipient — non-blocking, failures never block the message send
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.RECONFIRMATION_EMAIL_FROM;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ownercars.co.uk";

    if (supabaseUrl && serviceRoleKey && resendApiKey && from) {
      const admin = createClient(supabaseUrl, serviceRoleKey);

      // Need vehicle details and seller_id to determine direction and compose subject
      const { data: advert } = await admin
        .from("adverts")
        .select("seller_id, year, make, model")
        .eq("id", advertId)
        .maybeSingle();

      if (advert) {
        const senderIsSeller = user.id === advert.seller_id;
        // otherUserId from the thread is always the non-current-user (the recipient)
        const recipientId = otherUserId;

        const userRes = await fetch(
          `${supabaseUrl}/auth/v1/admin/users/${recipientId}`,
          {
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: serviceRoleKey,
            },
          }
        );

        if (userRes.ok) {
          const userData = await userRes.json();
          const recipientEmail: string | undefined = userData?.email;

          if (recipientEmail) {
            const advertTitle = [advert.year, advert.make, advert.model]
              .filter(Boolean)
              .join(" ");

            if (senderIsSeller) {
              // ── Seller replied → notify buyer ─────────────────────────────
              // From the buyer's view, otherUserId = sellerId, so thread URL uses seller_id
              const threadId = messageThreadId(advertId, advert.seller_id);
              const viewUrl = `${siteUrl}/messages/${threadId}`;
              const subject = advertTitle
                ? `You have a reply about the ${advertTitle}`
                : "You have a reply about your enquiry";

              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${resendApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from,
                  to: recipientEmail,
                  subject,
                  html: `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                    <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
                        <tr><td align="center">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
                            <tr>
                              <td style="background:#1c2030;padding:24px 32px;">
                                <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                                  Owner<span style="color:#2563EB;">Cars</span>
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:32px;">
                                <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">The seller has replied</p>
                                <p style="margin:0 0 28px;font-size:14px;color:#6b7280;">
                                  ${advertTitle ? `The seller of the <strong>${advertTitle}</strong> has replied to your message on OwnerCars.` : "The seller has replied to your message on OwnerCars."}
                                </p>
                                <a href="${viewUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">View reply on OwnerCars</a>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
                                <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because you sent a message via <a href="${siteUrl}" style="color:#2563EB;text-decoration:none;">OwnerCars</a>. Reply directly on-platform to keep your details private.</p>
                              </td>
                            </tr>
                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                  `,
                  text: `The seller has replied to your message on OwnerCars.\n\nView the reply here: ${viewUrl}`,
                }),
              });
            } else {
              // ── Buyer replied → notify seller ─────────────────────────────
              // From the seller's view, otherUserId = buyerId = user.id (the sender)
              const threadId = messageThreadId(advertId, user.id);
              const viewUrl = `${siteUrl}/messages/${threadId}`;
              const subject = advertTitle
                ? `New message about your ${advertTitle} on OwnerCars`
                : "New message on OwnerCars";

              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${resendApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from,
                  to: recipientEmail,
                  subject,
                  html: `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                    <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
                        <tr><td align="center">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
                            <tr>
                              <td style="background:#1c2030;padding:24px 32px;">
                                <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                                  Owner<span style="color:#2563EB;">Cars</span>
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:32px;">
                                <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">You have a new message</p>
                                <p style="margin:0 0 28px;font-size:14px;color:#6b7280;">Someone sent you a follow-up message about your <strong>${advertTitle || "advert"}</strong> on OwnerCars.</p>
                                <a href="${viewUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">View message</a>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
                                <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because someone messaged your advert on <a href="${siteUrl}" style="color:#2563EB;text-decoration:none;">OwnerCars</a>.</p>
                              </td>
                            </tr>
                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                  `,
                  text: `You have a new message about your ${advertTitle || "advert"} on OwnerCars.\n\nView it here: ${viewUrl}`,
                }),
              });
            }
          }
        }
      }
    }
  } catch (emailErr) {
    console.error("Failed to send reply notification:", emailErr);
  }

  return NextResponse.json({ message });
}
