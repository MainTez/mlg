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
      .from("opponent_notes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notes: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load notes." },
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
    const { opponent, patch, side, notes } = body || {};

    if (!opponent || !notes) {
      return NextResponse.json(
        { error: "Missing opponent or notes." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("opponent_notes")
      .insert([
        {
          opponent,
          patch: patch || "",
          side: side || "",
          notes
        }
      ])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notes: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to add note." },
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
      return NextResponse.json({ error: "Missing note id." }, { status: 400 });
    }

    const { error } = await supabase
      .from("opponent_notes")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete note." },
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
    const { id, opponent, patch, side, notes } = body || {};

    if (!id || !opponent || !notes) {
      return NextResponse.json(
        { error: "Missing note id, opponent, or notes." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("opponent_notes")
      .update({
        opponent,
        patch: patch || "",
        side: side || "",
        notes
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notes: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update note." },
      { status: 500 }
    );
  }
}
