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
      .from("tournaments")
      .select("*")
      .order("starts_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tournaments: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load tournaments." },
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
    const { name, status, starts_at, location, notes } = body || {};

    if (!name || !status) {
      return NextResponse.json(
        { error: "Missing tournament name or status." },
        { status: 400 }
      );
    }

    const startsAtValue = starts_at ? new Date(starts_at).toISOString() : null;

    const { data, error } = await supabase
      .from("tournaments")
      .insert([
        {
          name,
          status,
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

    return NextResponse.json({ tournaments: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to add tournament." },
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
    const { id, name, status, starts_at, location, notes } = body || {};

    if (!id || !name || !status) {
      return NextResponse.json(
        { error: "Missing tournament id, name, or status." },
        { status: 400 }
      );
    }

    const startsAtValue = starts_at ? new Date(starts_at).toISOString() : null;

    const { data, error } = await supabase
      .from("tournaments")
      .update({
        name,
        status,
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

    return NextResponse.json({ tournaments: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update tournament." },
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
        { error: "Missing tournament id." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("tournaments").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete tournament." },
      { status: 500 }
    );
  }
}
