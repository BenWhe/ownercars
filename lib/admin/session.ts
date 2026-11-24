import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/messages/send";
import { isAdmin } from "@/lib/messages/review";

/** The signed-in user if they're in public.admin_users, otherwise null. */
export async function getAdminUser(): Promise<{ id: string; email: string | null } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createAdminClient();
  if (!url || !anonKey || !admin) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(admin, user.id))) return null;
  return { id: user.id, email: user.email ?? null };
}
