import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isValidDocumentType, DOCUMENT_DISPLAY_NAMES } from "@/lib/vault/documents";
import { messageThreadId, parseMessageThreadId } from "@/lib/messages/thread";

const SIGNED_URL_EXPIRY_SECONDS = 900; // 15 minutes

// POST /api/vault/share
// Seller shares a document with the buyer via the message thread.
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

  let body: {
    advert_id?: string;
    document_type?: string;
    thread_id?: string;
    request_message_id?: string;
  };
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

  const buyerId = thread.otherUserId;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Verify user is the seller
  const { data: advert } = await supabase
    .from("adverts")
    .select("id, seller_id, year, make, model")
    .eq("id", advert_id)
    .maybeSingle();

  if (!advert || advert.seller_id !== user.id) {
    return NextResponse.json({ error: "Not authorised to share documents for this advert." }, { status: 403 });
  }

  // Fetch the vault document
  const { data: doc } = await supabase
    .from("vault_documents")
    .select("id, file_url, document_type")
    .eq("advert_id", advert_id)
    .eq("document_type", document_type)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Document not found in vault." }, { status: 404 });
  }

  const displayName = DOCUMENT_DISPLAY_NAMES[document_type];
  let signedUrl: string;
  let urlExpiresAt: string;

  if (document_type === "video_link") {
    // Video links are stored as plain URLs — share directly
    signedUrl = doc.file_url;
    // Set a far-future expiry to indicate it doesn't expire
    urlExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  } else {
    // Generate a signed URL from the private bucket
    const { data: signed, error: signError } = await supabase.storage
      .from("vault-documents")
      .createSignedUrl(doc.file_url, SIGNED_URL_EXPIRY_SECONDS);

    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ error: "Could not generate secure link." }, { status: 500 });
    }

    signedUrl = signed.signedUrl;
    urlExpiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString();
  }

  const { error } = await supabase.from("messages").insert({
    advert_id,
    sender_id: user.id,
    recipient_id: buyerId,
    event_type: "document_share",
    document_type,
    signed_url: signedUrl,
    url_expires_at: urlExpiresAt,
    body: `Shared ${displayName} · link expires in 15 minutes`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Notify the buyer — non-blocking, failures never block the share
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.RECONFIRMATION_EMAIL_FROM;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ownercars.co.uk";

    if (resendApiKey && from) {
      const userRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${buyerId}`,
        {
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
        }
      );

      if (userRes.ok) {
        const userData = await userRes.json();
        const buyerEmail: string | undefined = userData?.email;

        if (buyerEmail) {
          const advertTitle = [advert.year, advert.make, advert.model]
            .filter(Boolean)
            .join(" ");
          // Thread URL from the buyer's perspective: other user = seller = user.id
          const threadUrl = `${siteUrl}/messages/${messageThreadId(advert_id, user.id)}`;
          const subject = `The seller has shared their ${displayName} on OwnerCars`;
          const expiryNote = document_type === "video_link"
            ? "The link does not expire."
            : "The document link expires in 15 minutes — open it on OwnerCars before it does.";

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from,
              to: buyerEmail,
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
                            <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">The seller has shared a document</p>
                            <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
                              The seller of the${advertTitle ? ` <strong>${advertTitle}</strong>` : " advert"} has shared their <strong>${displayName}</strong> with you on OwnerCars.
                            </p>
                            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;">${expiryNote}</p>
                            <a href="${threadUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 28px;border-radius:8px;">View document on OwnerCars</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
                            <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because a seller shared a document via <a href="${siteUrl}" style="color:#2563EB;text-decoration:none;">OwnerCars</a>. Open it on-platform to keep your details private.</p>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
              `,
              text: `The seller has shared their ${displayName} on OwnerCars.\n\n${advertTitle ? `Advert: ${advertTitle}\n\n` : ""}${expiryNote}\n\nView it on OwnerCars:\n${threadUrl}`,
            }),
          });
        }
      }
    }
  } catch (emailErr) {
    console.error("Failed to send vault share notification:", emailErr);
  }

  return NextResponse.json({ success: true });
}
