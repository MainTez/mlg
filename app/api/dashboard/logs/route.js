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
      .from("logs")
      .select("*")
      .order("played_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load logs." },
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
    const { opponent, result, score, played_at } = body || {};

    if (!opponent || !result) {
      return NextResponse.json(
        { error: "Missing log opponent or result." },
        { status: 400 }
      );
    }

    const playedAtValue = played_at ? new Date(played_at).toISOString() : null;

    const { data, error } = await supabase
      .from("logs")
      .insert([
        {
          opponent,
          result,
          score: score || "",
          played_at: playedAtValue
        }
      ])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to add log." },
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
      return NextResponse.json({ error: "Missing log id." }, { status: 400 });
    }

    const { error } = await supabase.from("logs").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete log." },
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
    const { id, opponent, result, score, played_at } = body || {};

    if (!id || !opponent || !result) {
      return NextResponse.json(
        { error: "Missing log id, opponent, or result." },
        { status: 400 }
      );
    }

    const playedAtValue = played_at ? new Date(played_at).toISOString() : null;

    const { data, error } = await supabase
      .from("logs")
      .update({
        opponent,
        result,
        score: score || "",
        played_at: playedAtValue
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update log." },
      { status: 500 }
    );
  }
}
