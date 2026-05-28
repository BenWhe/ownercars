import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

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

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: conversation, error: convoError } = await supabase
    .from("conversations")
    .select(`
      *,
      adverts (
        id,
        year,
        make,
        model,
        price
      )
    `)
    .eq("id", id)
    .single();

  if (convoError) {
    return NextResponse.json({ error: convoError.message }, { status: 400 });
  }

  if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) {
    return NextResponse.json({ error: "Not authorised to view this conversation." }, { status: 403 });
  }

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 400 });
  }

  return NextResponse.json({ conversation, messages: messages || [], userId: user.id });
}
