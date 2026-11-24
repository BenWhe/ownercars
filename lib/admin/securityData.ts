import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { HOLD_REASON_LABELS, type HoldReason, type TrustStatus } from "@/lib/messages/review";
import type { ContactReason } from "@/lib/messages/contactDetails";
import { vehicleName } from "@/lib/seo/vehicle";

export const CONTACT_REASON_LABELS: Record<ContactReason, string> = {
  phone: "Phone number",
  phone_words: "Phone number in words",
  email: "Email address",
  link: "Link",
  messaging_app: "WhatsApp/other app",
  contact_request: "Asked to be contacted off-site",
};

type AdvertRef = { year?: number | null; make?: string | null; model?: string | null } | null;

function advertTitle(a: AdvertRef | AdvertRef[]): string {
  const ad = Array.isArray(a) ? a[0] : a;
  return ad ? vehicleName({ year: ad.year, make: ad.make, model: ad.model, title: "Advert" }) : "Advert";
}

export type HeldMessage = {
  id: string;
  createdAt: string;
  body: string;
  advertId: string;
  advert: string;
  senderId: string;
  senderEmail: string | null;
  senderSignedUp: string | null;
  senderTrust: TrustStatus;
  reasons: string[];
  ip: string | null;
  where: string;
  userAgent: string | null;
};

export type BlockedAttempt = {
  id: string;
  createdAt: string;
  body: string;
  advert: string;
  senderId: string;
  senderEmail: string | null;
  reasons: string[];
  ip: string | null;
  where: string;
};

export type AccountOfConcern = {
  userId: string;
  email: string | null;
  signedUp: string | null;
  trust: TrustStatus;
  blocked: number;
  rejected: number;
  pending: number;
  lastSeenIp: string | null;
  lastSeenWhere: string;
};

export type RecentSignup = {
  userId: string;
  email: string | null;
  signedUp: string;
  emailConfirmed: boolean;
  name: string | null;
  postcode: string | null;
  trust: TrustStatus;
  messagesSent: number;
};

export type SecurityStats = {
  days: number;
  messagesDelivered: number;
  messagesHeld: number;
  messagesApproved: number;
  messagesRejected: number;
  attemptsBlocked: number;
  accountsSuspended: number;
  pendingNow: number;
};

export type SecurityDashboardData = {
  stats: SecurityStats;
  allTime: SecurityStats;
  held: HeldMessage[];
  blocked: BlockedAttempt[];
  accounts: AccountOfConcern[];
  signups: RecentSignup[];
};

function where(city?: string | null, country?: string | null): string {
  return [city, country].filter(Boolean).join(", ") || "Unknown";
}

async function countMessages(
  admin: SupabaseClient,
  since: string | null,
  apply: (q: any) => any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<number> {
  let q = admin.from("messages").select("id", { count: "exact", head: true }).is("event_type", null);
  if (since) q = q.gte("created_at", since);
  const { count } = await apply(q);
  return count ?? 0;
}

async function stats(admin: SupabaseClient, days: number | null): Promise<SecurityStats> {
  const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
  const [delivered, held, approved, rejected, pendingNow, blocked, suspended] = await Promise.all([
    countMessages(admin, since, (q) => q.eq("status", "delivered")),
    countMessages(admin, since, (q) => q.neq("hold_reasons", "{}")),
    countMessages(admin, since, (q) => q.eq("status", "delivered").not("reviewed_at", "is", null)),
    countMessages(admin, since, (q) => q.eq("status", "rejected")),
    countMessages(admin, null, (q) => q.eq("status", "pending")),
    (async () => {
      let q = admin.from("message_blocks").select("id", { count: "exact", head: true });
      if (since) q = q.gte("created_at", since);
      return (await q).count ?? 0;
    })(),
    (async () => {
      let q = admin.from("account_trust").select("user_id", { count: "exact", head: true }).eq("status", "suspended");
      if (since) q = q.gte("updated_at", since);
      return (await q).count ?? 0;
    })(),
  ]);
  return {
    days: days ?? 0,
    messagesDelivered: delivered,
    messagesHeld: held,
    messagesApproved: approved,
    messagesRejected: rejected,
    attemptsBlocked: blocked,
    accountsSuspended: suspended,
    pendingNow,
  };
}

async function allUsers(admin: SupabaseClient): Promise<Map<string, User>> {
  const users = new Map<string, User>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) users.set(u.id, u);
    if (data.users.length < 1000) break;
  }
  return users;
}

export async function loadSecurityDashboard(admin: SupabaseClient): Promise<SecurityDashboardData> {
  const [last30, allTime, users, trustRows, heldRows, blockRows, rejectedRows, profiles, sentRows] = await Promise.all([
    stats(admin, 30),
    stats(admin, null),
    allUsers(admin),
    admin.from("account_trust").select("user_id, status").then((r) => r.data ?? []),
    admin
      .from("messages")
      .select("id, created_at, body, advert_id, sender_id, hold_reasons, sender_ip, sender_city, sender_country, sender_user_agent, adverts(year, make, model)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100)
      .then((r) => r.data ?? []),
    admin
      .from("message_blocks")
      .select("id, created_at, body, advert_id, sender_id, reasons, sender_ip, sender_city, sender_country")
      .order("created_at", { ascending: false })
      .limit(50)
      .then((r) => r.data ?? []),
    admin
      .from("messages")
      .select("sender_id, sender_ip, sender_city, sender_country, created_at")
      .eq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(500)
      .then((r) => r.data ?? []),
    admin.from("profiles").select("*").then((r) => r.data ?? []),
    admin
      .from("messages")
      .select("sender_id")
      .is("event_type", null)
      .limit(5000)
      .then((r) => r.data ?? []),
  ]);

  const trust = new Map<string, TrustStatus>(trustRows.map((t: { user_id: string; status: TrustStatus }) => [t.user_id, t.status]));
  const trustOf = (id: string): TrustStatus => trust.get(id) ?? "new";
  const emailOf = (id: string) => users.get(id)?.email ?? null;
  const signedUpOf = (id: string) => users.get(id)?.created_at ?? null;

  // Blocked attempts need advert titles; fetch the few adverts involved.
  const blockAdvertIds = [...new Set(blockRows.map((b: { advert_id: string | null }) => b.advert_id).filter(Boolean))] as string[];
  const blockAdverts = new Map<string, string>();
  if (blockAdvertIds.length) {
    const { data } = await admin.from("adverts").select("id, year, make, model").in("id", blockAdvertIds);
    for (const a of data ?? []) blockAdverts.set(a.id, advertTitle(a));
  }

  const held: HeldMessage[] = heldRows.map((m: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: m.id,
    createdAt: m.created_at,
    body: m.body,
    advertId: m.advert_id,
    advert: advertTitle(m.adverts),
    senderId: m.sender_id,
    senderEmail: emailOf(m.sender_id),
    senderSignedUp: signedUpOf(m.sender_id),
    senderTrust: trustOf(m.sender_id),
    reasons: ((m.hold_reasons ?? []) as HoldReason[]).map((r) => HOLD_REASON_LABELS[r] ?? r),
    ip: m.sender_ip,
    where: where(m.sender_city, m.sender_country),
    userAgent: m.sender_user_agent,
  }));

  const blocked: BlockedAttempt[] = blockRows.map((b: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: b.id,
    createdAt: b.created_at,
    body: b.body,
    advert: (b.advert_id && blockAdverts.get(b.advert_id)) || "Advert",
    senderId: b.sender_id,
    senderEmail: emailOf(b.sender_id),
    reasons: ((b.reasons ?? []) as ContactReason[]).map((r) => CONTACT_REASON_LABELS[r] ?? r),
    ip: b.sender_ip,
    where: where(b.sender_city, b.sender_country),
  }));

  // Accounts of concern: anything blocked, rejected, held or suspended.
  const concern = new Map<string, AccountOfConcern>();
  const touch = (id: string, ip: string | null, city: string | null, country: string | null) => {
    let a = concern.get(id);
    if (!a) {
      a = {
        userId: id,
        email: emailOf(id),
        signedUp: signedUpOf(id),
        trust: trustOf(id),
        blocked: 0,
        rejected: 0,
        pending: 0,
        lastSeenIp: ip,
        lastSeenWhere: where(city, country),
      };
      concern.set(id, a);
    }
    return a;
  };
  for (const b of blockRows) touch(b.sender_id, b.sender_ip, b.sender_city, b.sender_country).blocked++;
  for (const r of rejectedRows) touch(r.sender_id, r.sender_ip, r.sender_city, r.sender_country).rejected++;
  // A held message only makes an account "of concern" if it was held for
  // more than being new (a first-time buyer awaiting approval isn't).
  for (const h of heldRows) {
    const reasons = (h.hold_reasons ?? []) as string[];
    if (reasons.some((r) => r !== "new_account")) touch(h.sender_id, h.sender_ip, h.sender_city, h.sender_country);
  }
  for (const h of heldRows) {
    const a = concern.get(h.sender_id);
    if (a) a.pending++;
  }
  for (const t of trustRows) if (t.status === "suspended") touch(t.user_id, null, null, null);

  const profileOf = new Map(profiles.map((p: Record<string, unknown>) => [p.id as string, p]));
  const sentCount = new Map<string, number>();
  for (const s of sentRows) sentCount.set(s.sender_id, (sentCount.get(s.sender_id) ?? 0) + 1);

  const signups: RecentSignup[] = [...users.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 25)
    .map((u) => {
      const p = profileOf.get(u.id) as Record<string, unknown> | undefined;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
        (p?.full_name as string | undefined) ||
        (meta.full_name as string | undefined) ||
        null;
      return {
        userId: u.id,
        email: u.email ?? null,
        signedUp: u.created_at,
        emailConfirmed: !!u.email_confirmed_at,
        name,
        postcode: (p?.postcode as string | undefined) ?? (meta.postcode as string | undefined) ?? null,
        trust: trustOf(u.id),
        messagesSent: sentCount.get(u.id) ?? 0,
      };
    });

  return {
    stats: last30,
    allTime,
    held,
    blocked,
    accounts: [...concern.values()].sort((a, b) => b.blocked + b.rejected - (a.blocked + a.rejected)),
    signups,
  };
}
