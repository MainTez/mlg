import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAuth } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

const normalizeCore = (core) => {
  if (!core) {
    return [];
  }
  if (Array.isArray(core)) {
    return core.map((entry) => String(entry).trim()).filter(Boolean);
  }
  return String(core)
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
      .from("comps")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comps: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load comps." },
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
    const { label, situation, core, notes } = body || {};

    if (!label) {
      return NextResponse.json(
        { error: "Missing comp label." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("comps")
      .insert([
        {
          label,
          situation: situation || "",
          core: normalizeCore(core),
          notes: notes || ""
        }
      ])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comps: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to add comp." },
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
      return NextResponse.json({ error: "Missing comp id." }, { status: 400 });
    }

    const { error } = await supabase.from("comps").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete comp." },
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
    const { id, label, situation, core, notes } = body || {};

    if (!id || !label) {
      return NextResponse.json(
        { error: "Missing comp id or label." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("comps")
      .update({
        label,
        situation: situation || "",
        core: normalizeCore(core),
        notes: notes || ""
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comps: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update comp." },
      { status: 500 }
    );
  }
}
