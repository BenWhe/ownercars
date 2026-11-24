import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin/session";
import { createAdminClient } from "@/lib/messages/send";
import {
  reviewMessage,
  suspendAccount,
  unsuspendAccount,
  verifyReviewToken,
  type ReviewAction,
} from "@/lib/messages/review";

/**
 * POST /api/admin/moderation
 *
 * Message decisions: { action: "approve" | "reject" | "reject_suspend", messageId, token? }
 *   Allowed for a signed-in admin, or with the signed token from the review
 *   email (so a decision can be made from a phone without logging in).
 * Account actions: { action: "suspend" | "unsuspend", userId }
 *   Signed-in admin only.
 */
export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Server configuration error." }, { status: 500 });

  let body: { action?: string; messageId?: string; userId?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const adminUser = await getAdminUser();
  const action = body.action;

  if (action === "approve" || action === "reject" || action === "reject_suspend") {
    const messageId = body.messageId;
    if (!messageId) return NextResponse.json({ error: "messageId is required." }, { status: 400 });
    if (!adminUser && !verifyReviewToken(messageId, body.token)) {
      return NextResponse.json({ error: "Not authorised." }, { status: 403 });
    }
    const result = await reviewMessage(admin, messageId, action as ReviewAction, adminUser?.id ?? null);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  }

  if (action === "suspend" || action === "unsuspend") {
    if (!adminUser) return NextResponse.json({ error: "Not authorised." }, { status: 403 });
    if (!body.userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });
    if (body.userId === adminUser.id) {
      return NextResponse.json({ error: "You can't suspend your own account." }, { status: 400 });
    }
    if (action === "suspend") await suspendAccount(admin, body.userId, adminUser.id, "Suspended from dashboard");
    else await unsuspendAccount(admin, body.userId, adminUser.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
