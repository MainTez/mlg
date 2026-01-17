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
      .from("opponent_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ opponents: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load opponents." },
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
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { opponent, tendencies, win_conditions, draft_notes, pocket_picks } =
      body || {};

    if (!opponent) {
      return NextResponse.json(
        { error: "Missing opponent name." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("opponent_profiles")
      .insert([
        {
          opponent,
          tendencies: tendencies || "",
          win_conditions: win_conditions || "",
          draft_notes: draft_notes || "",
          pocket_picks: pocket_picks || ""
        }
      ])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ opponents: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to add opponent." },
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
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { id, opponent, tendencies, win_conditions, draft_notes, pocket_picks } =
      body || {};

    if (!id || !opponent) {
      return NextResponse.json(
        { error: "Missing opponent id or name." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("opponent_profiles")
      .update({
        opponent,
        tendencies: tendencies || "",
        win_conditions: win_conditions || "",
        draft_notes: draft_notes || "",
        pocket_picks: pocket_picks || ""
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ opponents: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update opponent." },
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
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { id } = body || {};

    if (!id) {
      return NextResponse.json(
        { error: "Missing opponent id." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("opponent_profiles")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete opponent." },
      { status: 500 }
    );
  }
}
