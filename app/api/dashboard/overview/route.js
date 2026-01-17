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
    const supabase = getSupabaseAdmin();
    const [
      roster,
      comps,
      logs,
      notes,
      tournaments,
      schedule,
      drafts,
      opponents,
      skinGoals,
      practiceGoals,
      metaWatchlist
    ] = await Promise.all([
      supabase.from("roster").select("*").order("role_order", { ascending: true }),
      supabase.from("comps").select("*").order("created_at", { ascending: false }),
      supabase.from("logs").select("*").order("played_at", { ascending: false }),
      supabase
        .from("opponent_notes")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("tournaments")
        .select("*")
        .order("starts_at", { ascending: true }),
      supabase
        .from("schedule_events")
        .select("*")
        .order("starts_at", { ascending: true }),
      supabase
        .from("draft_boards")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("opponent_profiles")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("skin_goals")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("practice_goals")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("meta_watchlist")
        .select("*")
        .order("created_at", { ascending: false })
    ]);

    if (
      roster.error ||
      comps.error ||
      logs.error ||
      notes.error ||
      tournaments.error ||
      schedule.error ||
      drafts.error ||
      opponents.error ||
      skinGoals.error ||
      practiceGoals.error ||
      metaWatchlist.error
    ) {
      return NextResponse.json(
        {
          error:
            roster.error?.message ||
            comps.error?.message ||
            logs.error?.message ||
            notes.error?.message ||
            tournaments.error?.message ||
            schedule.error?.message ||
            drafts.error?.message ||
            opponents.error?.message ||
            skinGoals.error?.message ||
            practiceGoals.error?.message ||
            metaWatchlist.error?.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        roster: roster.data || [],
        comps: comps.data || [],
        logs: logs.data || [],
        notes: notes.data || [],
        tournaments: tournaments.data || [],
        schedule: schedule.data || [],
        drafts: drafts.data || [],
        opponents: opponents.data || [],
        skinGoals: skinGoals.data || [],
        practiceGoals: practiceGoals.data || [],
        metaWatchlist: metaWatchlist.data || []
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load dashboard data." },
      { status: 500 }
    );
  }
}
