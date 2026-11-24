import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin/session";
import { vehicleName } from "@/lib/seo/vehicle";
import { createAdminClient } from "@/lib/messages/send";
import { HOLD_REASON_LABELS, verifyReviewToken, type HoldReason } from "@/lib/messages/review";
import ModerationButtons from "../../security/ModerationButtons";

export const metadata: Metadata = {
  title: "Review message",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
};

// Opened from the "Review needed" email. Viewing never changes anything:
// the decision is a button press (POST), so mail scanners that pre-open
// links can't approve or reject a message.
export default async function ReviewMessagePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { t } = await searchParams;
  const admin = createAdminClient();
  if (!admin) notFound();

  const tokenOk = verifyReviewToken(id, t);
  if (!tokenOk && !(await getAdminUser())) notFound();

  const { data: msg } = await admin
    .from("messages")
    .select("id, created_at, body, status, sender_id, hold_reasons, sender_ip, sender_city, sender_country, sender_user_agent, adverts(year, make, model)")
    .eq("id", id)
    .maybeSingle();
  if (!msg) notFound();

  const { data: senderData } = await admin.auth.admin.getUserById(msg.sender_id);
  const ad = (Array.isArray(msg.adverts) ? msg.adverts[0] : msg.adverts) as
    | { year?: number; make?: string; model?: string }
    | null;
  const title = ad ? vehicleName({ ...ad, title: "an advert" }) : "an advert";
  const reasons = ((msg.hold_reasons ?? []) as HoldReason[]).map((r) => HOLD_REASON_LABELS[r] ?? r);

  return (
    <main className="sec-page">
      <section className="dashboard-hero">
        <p className="eyebrow">Review message</p>
        <h1>Message about {title}</h1>
        <p>
          {msg.status === "pending"
            ? "The seller hasn't seen this yet. Approving delivers it and emails the seller."
            : msg.status === "delivered"
              ? "This message has already been approved and delivered."
              : "This message has already been rejected."}
        </p>
      </section>

      <article className="sec-card">
        <blockquote>{msg.body}</blockquote>
        <dl>
          <dt>From</dt>
          <dd>{senderData?.user?.email ?? "Unknown"}</dd>
          <dt>Signed up</dt>
          <dd>{senderData?.user?.created_at ? new Date(senderData.user.created_at).toUTCString() : "Unknown"}</dd>
          <dt>Sent</dt>
          <dd>{new Date(msg.created_at).toUTCString()}</dd>
          <dt>Sent from</dt>
          <dd>
            {[msg.sender_city, msg.sender_country].filter(Boolean).join(", ") || "Unknown"} · IP {msg.sender_ip ?? "unknown"}
          </dd>
          <dt>Why held</dt>
          <dd>{reasons.join("; ") || "—"}</dd>
          <dt>Device</dt>
          <dd className="sec-small">{msg.sender_user_agent ?? "Unknown"}</dd>
        </dl>
        {msg.status === "pending" && <ModerationButtons kind="message" messageId={msg.id} token={t} />}
      </article>

      <p className="sec-note">
        <a href="/admin/security">Open the security dashboard</a> (sign-in required).
      </p>
    </main>
  );
}
