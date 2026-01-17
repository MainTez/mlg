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
      .from("skin_goals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load skin goals." },
        { status: 500 }
      );
    }

    return NextResponse.json({ skinGoals: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load skin goals." },
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
    const { player_name, tagline, target_rank, skin, notes } = body || {};
    if (!player_name || !tagline || !target_rank || !skin) {
      return NextResponse.json(
        { error: "Missing player, tagline, target rank, or skin." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("skin_goals")
      .insert({
        player_name,
        tagline,
        target_rank,
        skin,
        notes: notes || ""
      })
      .select("*");

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to add skin goal." },
        { status: 500 }
      );
    }

    return NextResponse.json({ skinGoals: data || [] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to add skin goal." },
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
    const {
      id,
      player_name,
      tagline,
      target_rank,
      skin,
      notes,
      completed_at
    } = body || {};
    if (!id || !player_name || !tagline || !target_rank || !skin) {
      return NextResponse.json(
        { error: "Missing id, player, tagline, target rank, or skin." },
        { status: 400 }
      );
    }

    const payload = {
      player_name,
      tagline,
      target_rank,
      skin,
      notes: notes || ""
    };
    if (completed_at !== undefined) {
      payload.completed_at = completed_at || null;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("skin_goals")
      .update(payload)
      .eq("id", id)
      .select("*");

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update skin goal." },
        { status: 500 }
      );
    }

    return NextResponse.json({ skinGoals: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update skin goal." },
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
      return NextResponse.json({ error: "Missing skin goal id." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("skin_goals").delete().eq("id", id);
    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to delete skin goal." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete skin goal." },
      { status: 500 }
    );
  }
}
