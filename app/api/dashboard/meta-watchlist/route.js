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
      .from("meta_watchlist")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load meta watchlist." },
        { status: 500 }
      );
    }

    return NextResponse.json({ metaWatchlist: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load meta watchlist." },
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
    const { champion, role, priority, reason, notes } = body || {};
    if (!champion) {
      return NextResponse.json(
        { error: "Missing champion name." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("meta_watchlist")
      .insert({
        champion,
        role: role || "",
        priority: priority || "Medium",
        reason: reason || "",
        notes: notes || ""
      })
      .select("*");

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to add meta watchlist." },
        { status: 500 }
      );
    }

    return NextResponse.json({ metaWatchlist: data || [] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to add meta watchlist." },
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
    const { id, champion, role, priority, reason, notes } = body || {};
    if (!id || !champion) {
      return NextResponse.json(
        { error: "Missing id or champion name." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("meta_watchlist")
      .update({
        champion,
        role: role || "",
        priority: priority || "Medium",
        reason: reason || "",
        notes: notes || ""
      })
      .eq("id", id)
      .select("*");

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update meta watchlist." },
        { status: 500 }
      );
    }

    return NextResponse.json({ metaWatchlist: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update meta watchlist." },
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
        { error: "Missing meta watchlist id." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("meta_watchlist").delete().eq("id", id);
    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to delete meta watchlist." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete meta watchlist." },
      { status: 500 }
    );
  }
}
