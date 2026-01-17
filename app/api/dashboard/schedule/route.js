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
      .from("schedule_events")
      .select("*")
      .order("starts_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedule: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load schedule." },
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
    const { title, type, opponent, starts_at, location, notes } = body || {};

    if (!title || !type) {
      return NextResponse.json(
        { error: "Missing schedule title or type." },
        { status: 400 }
      );
    }

    const startsAtValue = starts_at ? new Date(starts_at).toISOString() : null;

    const { data, error } = await supabase
      .from("schedule_events")
      .insert([
        {
          title,
          type,
          opponent: opponent || "",
          starts_at: startsAtValue,
          location: location || "",
          notes: notes || ""
        }
      ])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedule: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to add schedule event." },
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
    const { id, title, type, opponent, starts_at, location, notes } = body || {};

    if (!id || !title || !type) {
      return NextResponse.json(
        { error: "Missing schedule id, title, or type." },
        { status: 400 }
      );
    }

    const startsAtValue = starts_at ? new Date(starts_at).toISOString() : null;

    const { data, error } = await supabase
      .from("schedule_events")
      .update({
        title,
        type,
        opponent: opponent || "",
        starts_at: startsAtValue,
        location: location || "",
        notes: notes || ""
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedule: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update schedule event." },
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
        { error: "Missing schedule id." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("schedule_events")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete schedule event." },
      { status: 500 }
    );
  }
}
