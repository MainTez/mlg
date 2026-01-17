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
    const { data, error } = await supabase
      .from("practice_goals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load practice goals." },
        { status: 500 }
      );
    }

    return NextResponse.json({ practiceGoals: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load practice goals." },
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
    const { player_name, tagline, goal, timeframe, status, notes } = body || {};
    if (!player_name || !tagline || !goal) {
      return NextResponse.json(
        { error: "Missing player, tagline, or goal." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("practice_goals")
      .insert({
        player_name,
        tagline,
        goal,
        timeframe: timeframe || "",
        status: status || "Active",
        notes: notes || ""
      })
      .select("*");

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to add practice goal." },
        { status: 500 }
      );
    }

    return NextResponse.json({ practiceGoals: data || [] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to add practice goal." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { id, player_name, tagline, goal, timeframe, status, notes } =
      body || {};
    if (!id || !player_name || !tagline || !goal) {
      return NextResponse.json(
        { error: "Missing id, player, tagline, or goal." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("practice_goals")
      .update({
        player_name,
        tagline,
        goal,
        timeframe: timeframe || "",
        status: status || "Active",
        notes: notes || ""
      })
      .eq("id", id)
      .select("*");

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update practice goal." },
        { status: 500 }
      );
    }

    return NextResponse.json({ practiceGoals: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update practice goal." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body || {};
    if (!id) {
      return NextResponse.json(
        { error: "Missing practice goal id." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("practice_goals").delete().eq("id", id);
    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to delete practice goal." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete practice goal." },
      { status: 500 }
    );
  }
}
