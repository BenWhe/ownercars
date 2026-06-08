import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";
import { messageThreadId } from "@/lib/messages/thread";

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

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  if (!supabase) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      advert_id,
      sender_id,
      recipient_id,
      body,
      read_at,
      created_at,
      adverts (
        id,
        year,
        make,
        model,
        price
      )
    `)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const conversations = new Map<string, any>();

  for (const msg of data || []) {
    const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
    const threadId = messageThreadId(msg.advert_id, otherUserId);
    const existing = conversations.get(threadId);

    if (!existing) {
      conversations.set(threadId, {
        id: threadId,
        advert_id: msg.advert_id,
        other_user_id: otherUserId,
        adverts: msg.adverts,
        lastMessage: msg,
        unreadCount: msg.recipient_id === user.id && !msg.read_at ? 1 : 0,
        status: "open",
      });
    } else if (msg.recipient_id === user.id && !msg.read_at) {
      existing.unreadCount += 1;
    }
  }

  return NextResponse.json({ conversations: Array.from(conversations.values()), userId: user.id });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  if (!supabase) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let payload: { advertId?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const advertId = payload.advertId;
  const body = payload.body?.trim();

  if (!advertId || !body) {
    return NextResponse.json({ error: "Advert and message body are required." }, { status: 400 });
  }

  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id, seller_id, status, year, make, model")
    .eq("id", advertId)
    .eq("status", ADVERT_STATUS.PUBLISHED)
    .maybeSingle();

  if (advertError) {
    return NextResponse.json({ error: advertError.message }, { status: 400 });
  }

  if (!advert) {
    return NextResponse.json({ error: "This advert isn’t available for messaging." }, { status: 404 });
  }

  if (advert.seller_id === user.id) {
    return NextResponse.json({ error: "You cannot message your own advert." }, { status: 400 });
  }

  // Gate: buyer must have a postcode set before messaging
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("postcode")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.postcode) {
      return NextResponse.json(
        { error: "Please add your postcode to your account before messaging sellers.", code: "POSTCODE_REQUIRED" },
        { status: 403 }
      );
    }
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      advert_id: advert.id,
      sender_id: user.id,
      recipient_id: advert.seller_id,
      body,
    })
    .select("id, advert_id, sender_id, recipient_id, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Send email notification to recipient — non-blocking
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.RECONFIRMATION_EMAIL_FROM;

    if (serviceRoleKey && supabaseUrl && resendApiKey && from) {
      // Fetch recipient email via service role
      const userRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${advert.seller_id}`,
        {
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
        }
      );

      if (userRes.ok) {
        const userData = await userRes.json();
        const recipientEmail = userData?.email;

        if (recipientEmail) {
          const threadId = messageThreadId(advert.id, advert.seller_id);
          const viewUrl = `https://www.ownercars.co.uk/messages/${threadId}`;
          const preview = body.length > 200 ? body.slice(0, 200) + "…" : body;
          const advertTitle = [advert.year, advert.make, advert.model]
            .filter(Boolean)
            .join(" ");
          const subject = `New message about your ${advertTitle} on OwnerCars`;

          const safePreview = preview
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

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
                        <!-- Header -->
                        <tr>
                          <td style="background:#1c2030;padding:24px 32px;">
                            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                              Owner<span style="color:#2563EB;">Cars</span>
                            </span>
                          </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                          <td style="padding:32px;">
                            <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">You have a new message</p>
                            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Someone sent you a message about your <strong>${advertTitle}</strong>.</p>
                            <div style="background:#f9fafb;border-left:4px solid #2563EB;border-radius:4px;padding:16px 20px;margin-bottom:28px;">
                              <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${safePreview}</p>
                            </div>
                            <a href="${viewUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">View message</a>
                          </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
                            <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because someone messaged your advert on <a href="https://www.ownercars.co.uk" style="color:#2563EB;text-decoration:none;">OwnerCars</a>.</p>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
              `,
              text: `You have a new message about your ${advertTitle} on OwnerCars.\n\n"${preview}"\n\nView it here: ${viewUrl}`,
            }),
          });
        }
      }
    }
  } catch (emailErr) {
    console.error("Failed to send new message email notification:", emailErr);
  }

  return NextResponse.json({ message, threadId: messageThreadId(advert.id, advert.seller_id) });
}
