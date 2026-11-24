import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin/session";
import { loadSecurityDashboard } from "@/lib/admin/securityData";
import { createAdminClient } from "@/lib/messages/send";
import ModerationButtons from "./ModerationButtons";

export const metadata: Metadata = {
  title: "Security",
  robots: { index: false, follow: false },
};

// Always fresh: this page shows live moderation state.
export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function ago(iso: string | null): string {
  if (!iso) return "unknown";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

// The checks OwnerCars runs. Shown on the dashboard so it's clear what is
// active; add a line here whenever a new check ships.
const PROTECTIONS: { name: string; detail: string }[] = [
  {
    name: "Contact-detail filter",
    detail:
      "Messages containing phone numbers (in any format, including written out), email addresses, links or WhatsApp/Telegram requests are refused before they reach the seller.",
  },
  {
    name: "Review hold for new accounts",
    detail:
      "A buyer's messages are held until one has been checked and approved. The seller never sees a held message.",
  },
  {
    name: "Location check",
    detail: "Messages sent from outside the UK are held for review.",
  },
  {
    name: "Copy-paste and speed checks",
    detail:
      "The same text sent about different adverts, or one account messaging three or more adverts within 15 minutes, is held for review.",
  },
  {
    name: "Real-identity checks",
    detail:
      "Buyers must confirm their email and give a first name, surname and postcode before messaging. Accounts using landmark or example postcodes, made-up names or throwaway email addresses are held for review.",
  },
  {
    name: "Seller reports",
    detail:
      "Sellers can report any message they receive. A reported account's messages are held for review again until the report has been looked at.",
  },
  {
    name: "Scam warnings for sellers",
    detail:
      "Messages that mention common scam tactics (couriers, unusual payments, codes, logbook photos, pressure to finalise) carry a warning to the seller.",
  },
  {
    name: "Account IP history",
    detail:
      "Sign-in IP addresses, and the IP address and approximate location each account uses the site from, are recorded so accounts can be checked before they message anyone.",
  },
  {
    name: "Single secure send path",
    detail:
      "Every message goes through these checks on our server. Accounts can't write messages directly to the database.",
  },
  {
    name: "Evidence kept",
    detail:
      "Each message and blocked attempt records the sender's IP address, approximate location and device, for reports to Report Fraud and the police.",
  },
  {
    name: "Seller details never shown",
    detail: "Sellers' phone numbers, email addresses and postcodes are never shown on adverts or to buyers.",
  },
];

export default async function SecurityDashboardPage() {
  const adminUser = await getAdminUser();
  if (!adminUser) notFound();

  const admin = createAdminClient();
  if (!admin) notFound();
  const data = await loadSecurityDashboard(admin);
  const s = data.stats;
  const all = data.allTime;

  return (
    <main className="sec-page">
      <section className="dashboard-hero">
        <p className="eyebrow">Security and compliance</p>
        <h1>Protecting our sellers</h1>
        <p>
          Live view of the checks every message goes through, what they have stopped, and anything
          waiting for your decision.
        </p>
      </section>

      <section className="sec-section">
        <h2>Last 30 days</h2>
        <div className="sec-stats">
          <div className="sec-stat">
            <strong>{s.attemptsBlocked}</strong>
            <span>attempts to share contact details blocked</span>
          </div>
          <div className="sec-stat">
            <strong>{s.messagesHeld}</strong>
            <span>messages held for review</span>
          </div>
          <div className="sec-stat">
            <strong>{s.messagesRejected}</strong>
            <span>messages rejected</span>
          </div>
          <div className="sec-stat">
            <strong>{s.accountsSuspended}</strong>
            <span>accounts suspended</span>
          </div>
          <div className="sec-stat">
            <strong>{data.reports.length}</strong>
            <span>open reports from sellers</span>
          </div>
          <div className="sec-stat">
            <strong>{s.messagesApproved}</strong>
            <span>messages approved after review</span>
          </div>
          <div className="sec-stat">
            <strong>{s.messagesDelivered}</strong>
            <span>messages delivered</span>
          </div>
        </div>
        <p className="sec-note">
          Since records began: {all.attemptsBlocked} blocked, {all.messagesHeld} held, {all.messagesRejected} rejected,{" "}
          {all.accountsSuspended} accounts suspended, {all.messagesDelivered} delivered.
        </p>
      </section>

      <section className="sec-section">
        <h2>
          Waiting for review <span className="sec-count">{data.held.length}</span>
        </h2>
        {data.held.length === 0 ? (
          <p className="sec-empty">Nothing waiting. Held messages appear here and are emailed to you.</p>
        ) : (
          data.held.map((m) => (
            <article key={m.id} className="sec-card">
              <header>
                <strong>{m.advert}</strong>
                <span>{fmt(m.createdAt)}</span>
              </header>
              <blockquote>{m.body}</blockquote>
              <dl>
                <dt>From</dt>
                <dd>
                  {m.senderName ?? "No name"} · {m.senderEmail ?? "Unknown"} · signed up {ago(m.senderSignedUp)}
                </dd>
                <dt>Postcode given</dt>
                <dd>{m.senderPostcode ?? "None"}</dd>
                <dt>Sent from</dt>
                <dd>
                  {m.where} · IP {m.ip ?? "unknown"}
                </dd>
                <dt>Why held</dt>
                <dd>{m.reasons.join("; ")}</dd>
                <dt>Device</dt>
                <dd className="sec-small">{m.userAgent ?? "Unknown"}</dd>
              </dl>
              <ModerationButtons kind="message" messageId={m.id} />
            </article>
          ))
        )}
      </section>

      <section className="sec-section">
        <h2>
          Reported by sellers <span className="sec-count">{data.reports.length}</span>
        </h2>
        {data.reports.length === 0 ? (
          <p className="sec-empty">No open reports. Sellers can report any message they receive.</p>
        ) : (
          data.reports.map((r) => (
            <article key={r.id} className="sec-card">
              <header>
                <strong>{r.advert}</strong>
                <span>{fmt(r.createdAt)}</span>
              </header>
              <blockquote>{r.body}</blockquote>
              <dl>
                <dt>Reason</dt>
                <dd>{r.reason}</dd>
                <dt>Reported by</dt>
                <dd>{r.reporterEmail ?? "Unknown"}</dd>
                <dt>Sender</dt>
                <dd>
                  {r.reportedEmail ?? r.reportedUserId} · <span className={`sec-badge ${r.reportedTrust}`}>{r.reportedTrust}</span>{" "}
                  · <a className="sec-link" href={`/api/admin/evidence/${r.reportedUserId}`}>Evidence</a>
                </dd>
              </dl>
              <ModerationButtons
                kind="report"
                reportId={r.id}
                reportedUserId={r.reportedUserId}
                suspended={r.reportedTrust === "suspended"}
              />
            </article>
          ))
        )}
      </section>

      <section className="sec-section">
        <h2>Checks in place</h2>
        <ul className="sec-protections">
          {PROTECTIONS.map((p) => (
            <li key={p.name}>
              <span className="sec-on">On</span>
              <div>
                <strong>{p.name}</strong>
                <p>{p.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="sec-section">
        <h2>
          Accounts of concern <span className="sec-count">{data.accounts.length}</span>
        </h2>
        {data.accounts.length === 0 ? (
          <p className="sec-empty">No accounts have been blocked, held or rejected.</p>
        ) : (
          <div className="sec-table-wrap">
            <table className="sec-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Signed up</th>
                  <th>Status</th>
                  <th>Blocked</th>
                  <th>Rejected</th>
                  <th>Pending</th>
                  <th>Reports</th>
                  <th>Last seen from</th>
                  <th>IPs</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a) => (
                  <tr key={a.userId}>
                    <td>{a.email ?? a.userId}</td>
                    <td>{fmt(a.signedUp)}</td>
                    <td>
                      <span className={`sec-badge ${a.trust}`}>{a.trust}</span>
                    </td>
                    <td>{a.blocked}</td>
                    <td>{a.rejected}</td>
                    <td>{a.pending}</td>
                    <td>{a.reports}</td>
                    <td>
                      {a.lastSeenWhere}
                      {a.lastSeenIp ? ` · ${a.lastSeenIp}` : ""}
                    </td>
                    <td>
                      {a.ips.distinctIps || "—"}
                      {a.ips.flags.map((f) => (
                        <span key={f} className="sec-flag">
                          {f}
                        </span>
                      ))}
                    </td>
                    <td>
                      <a className="sec-link" href={`/api/admin/evidence/${a.userId}`}>
                        Evidence
                      </a>
                      <ModerationButtons kind="account" userId={a.userId} suspended={a.trust === "suspended"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sec-section">
        <h2>
          Blocked attempts <span className="sec-count">{data.blocked.length}</span>
        </h2>
        {data.blocked.length === 0 ? (
          <p className="sec-empty">No messages have been blocked yet.</p>
        ) : (
          <div className="sec-table-wrap">
            <table className="sec-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>From</th>
                  <th>Advert</th>
                  <th>Caught</th>
                  <th>Sent from</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {data.blocked.map((b) => (
                  <tr key={b.id}>
                    <td>{fmt(b.createdAt)}</td>
                    <td>{b.senderEmail ?? b.senderId}</td>
                    <td>{b.advert}</td>
                    <td>{b.reasons.join(", ")}</td>
                    <td>
                      {b.where}
                      {b.ip ? ` · ${b.ip}` : ""}
                    </td>
                    <td className="sec-body">{b.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sec-section">
        <h2>Recent sign-ups</h2>
        <div className="sec-table-wrap">
          <table className="sec-table">
            <thead>
              <tr>
                <th>Signed up</th>
                <th>Email</th>
                <th>Confirmed</th>
                <th>Name</th>
                <th>Postcode</th>
                <th>Status</th>
                <th>Messages sent</th>
                <th title="Earliest IP of a browser sign-in we still hold">First browser IP</th>
                <th>Last seen from</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {data.signups.map((u) => (
                <tr key={u.userId}>
                  <td>{fmt(u.signedUp)}</td>
                  <td>{u.email ?? "—"}</td>
                  <td>{u.emailConfirmed ? "Yes" : "No"}</td>
                  <td>{u.name ?? "—"}</td>
                  <td>{u.postcode ?? "—"}</td>
                  <td>
                    <span className={`sec-badge ${u.trust}`}>{u.trust}</span>
                  </td>
                  <td>{u.messagesSent}</td>
                  <td>{u.ips.signupIp ?? "—"}</td>
                  <td>
                    {u.ips.lastSeen ? (
                      <>
                        {u.ips.lastSeen.where} · {u.ips.lastSeen.ip}
                        <br />
                        <span className="sec-small">{fmt(u.ips.lastSeen.at)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {[...u.flags, ...u.ips.flags].length ? (
                      [...u.flags, ...u.ips.flags].map((f) => (
                        <span key={f} className="sec-flag">
                          {f}
                        </span>
                      ))
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="sec-note">
        Signed in as {adminUser.email}. To report an account, use &ldquo;Evidence&rdquo; to download its record,
        then file it at <a href="https://www.reportfraud.police.uk/">reportfraud.police.uk</a>.
      </p>
    </main>
  );
}
