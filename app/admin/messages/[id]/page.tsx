import { createClient } from "@supabase/supabase-js";
import { verifyReviewToken } from "@/lib/admin/reviewToken";
import ReviewActions from "./ReviewActions";

function createAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

function InvalidLink({ reason }: { reason: string }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Message review</p>
        <h1>{reason}</h1>
      </section>
    </main>
  );
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
};

// Server component: this page only ever reads data on GET, so prefetching
// an email link scanner might do can never release/reject a message. The
// token is verified here, server-side, before anything is rendered.
export default async function AdminMessageReviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { t } = await searchParams;

  if (!t || !verifyReviewToken(id, t)) {
    return <InvalidLink reason="This review link is invalid or has expired." />;
  }

  const admin = createAdmin();
  if (!admin) {
    return <InvalidLink reason="Server configuration error." />;
  }

  const { data: message } = await admin
    .from("messages")
    .select("id, advert_id, sender_id, body, delivery_status, held_reasons, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!message) {
    return <InvalidLink reason="Message not found." />;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const [{ data: advert }, { data: profile }, senderRes] = await Promise.all([
    admin
      .from("adverts")
      .select("year, make, model")
      .eq("id", message.advert_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("full_name, postcode")
      .eq("id", message.sender_id)
      .maybeSingle(),
    fetch(`${supabaseUrl}/auth/v1/admin/users/${message.sender_id}`, {
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
    }),
  ]);

  const senderData = senderRes.ok ? await senderRes.json() : null;
  const advertTitle = advert
    ? [advert.year, advert.make, advert.model].filter(Boolean).join(" ")
    : "(advert not found)";

  const details: Array<[string, string]> = [
    ["Advert", advertTitle],
    ["Sender email", senderData?.email ?? "unknown"],
    ["Sender name", profile?.full_name ?? "(not set)"],
    ["Sender postcode", profile?.postcode ?? "(not set)"],
    ["Account created", senderData?.created_at ?? "unknown"],
    ["Sent", message.created_at],
    ["Reasons", (message.held_reasons ?? []).join(", ") || "—"],
  ];

  return (
    <main className="auth-page">
      <section className="auth-card" style={{ maxWidth: "640px" }}>
        <p className="eyebrow">Message review</p>
        <h1>{advertTitle}</h1>

        <table style={{ width: "100%", marginBottom: "24px", fontSize: "14px" }}>
          <tbody>
            {details.map(([label, value]) => (
              <tr key={label}>
                <td style={{ color: "var(--muted, #888)", paddingRight: "16px", whiteSpace: "nowrap" }}>
                  {label}
                </td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p
          style={{
            whiteSpace: "pre-wrap",
            background: "var(--surface-muted, #f9fafb)",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "24px",
          }}
        >
          {message.body}
        </p>

        <ReviewActions
          messageId={message.id}
          token={t}
          initialStatus={message.delivery_status}
        />
      </section>
    </main>
  );
}
