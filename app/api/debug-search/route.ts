import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json({ error: "missing ?q=" }, { status: 400 });

  const [{ data: byGeneric, error: e1 }, { data: byName, error: e2 }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, generic_name")
        .ilike("generic_name", `%${q}%`)
        .order("name")
        .limit(20),
      supabase
        .from("products")
        .select("id, name, generic_name")
        .ilike("name", `%${q}%`)
        .order("name")
        .limit(20),
    ]);

  return NextResponse.json({
    query: q,
    byGenericName: { count: byGeneric?.length ?? 0, error: e1?.message ?? null, rows: byGeneric ?? [] },
    byName: { count: byName?.length ?? 0, error: e2?.message ?? null, rows: byName ?? [] },
  });
}
