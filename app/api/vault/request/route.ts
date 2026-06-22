import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isValidDocumentType, DOCUMENT_DISPLAY_NAMES } from "@/lib/vault/documents";
import { messageThreadId, parseMessageThreadId } from "@/lib/messages/thread";

// POST /api/vault/request
// Buyer requests a document from the seller via the message thread.
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: { advert_id?: string; document_type?: string; thread_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { advert_id, document_type, thread_id } = body;

  if (!advert_id || !document_type || !thread_id) {
    return NextResponse.json({ error: "Missing advert_id, document_type, or thread_id." }, { status: 400 });
  }

  if (!isValidDocumentType(document_type)) {
    return NextResponse.json({ error: "Invalid document_type." }, { status: 400 });
  }

  const thread = parseMessageThreadId(thread_id);
  if (!thread || thread.advertId !== advert_id) {
    return NextResponse.json({ error: "Invalid thread_id." }, { status: 400 });
  }

  const sellerId = thread.otherUserId;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Verify user is not the seller
  const { data: advert } = await supabase
    .from("adverts")
    .select("id, seller_id, year, make, model")
    .eq("id", advert_id)
    .maybeSingle();

  if (!advert) {
    return NextResponse.json({ error: "Advert not found." }, { status: 404 });
  }

  if (advert.seller_id === user.id) {
    return NextResponse.json({ error: "Sellers cannot request their own documents." }, { status: 403 });
  }

  // Require an existing message thread — buyer must have messaged the seller
  // first. Guards against thread injection by unrelated authenticated users.
  const { count: threadCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("advert_id", advert_id)
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${advert.seller_id}),` +
      `and(sender_id.eq.${advert.seller_id},recipient_id.eq.${user.id})`
    );

  if (!threadCount || threadCount === 0) {
    return NextResponse.json(
      { error: "Please message the seller before requesting documents." },
      { status: 403 }
    );
  }

  const displayName = DOCUMENT_DISPLAY_NAMES[document_type];
  const buyerLabel = user.email?.split("@")[0] ?? "A buyer";

  const { error } = await supabase.from("messages").insert({
    advert_id,
    sender_id: user.id,
    recipient_id: sellerId,
    event_type: "document_request",
    document_type,
    body: `${buyerLabel} has requested access to your ${displayName}.`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Notify the seller — non-blocking, failures never block the request
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.RECONFIRMATION_EMAIL_FROM;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ownercars.co.uk";

    if (resendApiKey && from) {
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
        const sellerEmail: string | undefined = userData?.email;

        if (sellerEmail) {
          const advertTitle = [advert.year, advert.make, advert.model]
            .filter(Boolean)
            .join(" ");
          // Thread URL from the seller's perspective: other user = buyer = user.id
          const threadUrl = `${siteUrl}/messages/${messageThreadId(advert_id, user.id)}`;
          const subject = `A buyer has requested your ${displayName} on OwnerCars`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from,
              to: sellerEmail,
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
                            <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">A buyer has requested a document</p>
                            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;">
                              A buyer enquiring about your${advertTitle ? ` <strong>${advertTitle}</strong>` : " advert"} has requested your <strong>${displayName}</strong>. Visit your messages to review the request and decide whether to share.
                            </p>
                            <a href="${threadUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">View request</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
                            <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because a buyer messaged your advert on <a href="${siteUrl}" style="color:#2563EB;text-decoration:none;">OwnerCars</a>.</p>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
              `,
              text: `A buyer has requested your ${displayName} on OwnerCars.\n\n${advertTitle ? `Advert: ${advertTitle}\n\n` : ""}Visit your messages to review the request and decide whether to share:\n${threadUrl}`,
            }),
          });
        }
      }
    }
  } catch (emailErr) {
    console.error("Failed to send vault request notification:", emailErr);
  }

  return NextResponse.json({ success: true });
}
