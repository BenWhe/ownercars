import { createBrowserClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { password, access_token, refresh_token } = await req.json();

    if (!password || !access_token || !refresh_token) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    const supabase = createBrowserClient(supabaseUrl, anonKey);

    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 400 });
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
