import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAuth } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    if (!gameId) {
      return NextResponse.json({ error: "Missing gameId." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("overlay_spell_timers")
      .select("*")
      .eq("game_id", gameId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ timers: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load timers." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const body = await request.json();
    const { game_id, puuid, spell_id, ends_at } = body || {};
    if (!game_id || !puuid || !spell_id || !ends_at) {
      return NextResponse.json(
        { error: "Missing game_id, puuid, spell_id, or ends_at." },
        { status: 400 }
      );
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("overlay_spell_timers")
      .upsert(
        {
          game_id,
          puuid,
          spell_id,
          ends_at,
          updated_by: auth?.user?.email || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: "game_id,puuid,spell_id" }
      )
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ timer: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update timer." },
      { status: 500 }
    );
  }
}
