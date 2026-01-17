import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAuth } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

const normalizeList = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("draft_boards")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ drafts: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load draft boards." },
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
    const { label, blue_bans, blue_picks, red_bans, red_picks, notes } = body || {};

    if (!label) {
      return NextResponse.json(
        { error: "Missing draft label." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("draft_boards")
      .insert([
        {
          label,
          blue_bans: normalizeList(blue_bans),
          blue_picks: normalizeList(blue_picks),
          red_bans: normalizeList(red_bans),
          red_picks: normalizeList(red_picks),
          notes: notes || ""
        }
      ])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ drafts: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to add draft board." },
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
    const { id, label, blue_bans, blue_picks, red_bans, red_picks, notes } =
      body || {};

    if (!id || !label) {
      return NextResponse.json(
        { error: "Missing draft id or label." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("draft_boards")
      .update({
        label,
        blue_bans: normalizeList(blue_bans),
        blue_picks: normalizeList(blue_picks),
        red_bans: normalizeList(red_bans),
        red_picks: normalizeList(red_picks),
        notes: notes || ""
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ drafts: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update draft board." },
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
        { error: "Missing draft id." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("draft_boards").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete draft board." },
      { status: 500 }
    );
  }
}
