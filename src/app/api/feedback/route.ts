import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, message, page, wallet } = body as {
    type: string;
    message: string;
    page: string;
    wallet?: string;
  };

  if (!type || !message || message.length < 5) {
    return NextResponse.json({ error: "Type and message (5+ chars) required" }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ error: "Message too long (max 2000 chars)" }, { status: 400 });
  }

  const { error } = await supabase.from("feedback").insert({
    type,
    message: message.trim(),
    page: page || null,
    wallet: wallet || null,
  });

  if (error) {
    console.error("feedback insert:", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
