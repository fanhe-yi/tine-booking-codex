import { NextResponse } from "next/server";
import { verifyLiffAccessToken } from "@/lib/line";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get("access_token") || "";
  const lineProfile = accessToken
    ? await verifyLiffAccessToken(accessToken, "reading")
    : null;

  if (!lineProfile) {
    return NextResponse.json({ childProfiles: [] });
  }

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("child_profiles")
    .select("id,age,gender,nickname,address,preferences,personality")
    .eq("line_user_id", lineProfile.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load child profiles", error);
    return NextResponse.json(
      {
        childProfiles: [],
        warning: "尚未建立寶貝資料表，已改用首次預約資料填寫。",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ childProfiles: data || [] });
}
