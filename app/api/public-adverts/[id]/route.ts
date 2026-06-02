import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { ADVERT_STATUS } from "@/lib/adverts/lifecycle";
import { redactContactDetails } from "@/lib/content/redaction";

type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: Context) {
  const { id } = await context.params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("adverts")
    .select("*, advert_photos(*)")
    .eq("id", id)
    .eq("status", ADVERT_STATUS.PUBLISHED)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "This advert isn’t live yet." }, { status: 404 });
  }

  const description = redactContactDetails(data.description);

  return NextResponse.json({
    advert: {
      ...data,
      description: description.text,
      description_contact_details_redacted: description.redacted,
    },
    userId: user?.id ?? null,
  });
}
