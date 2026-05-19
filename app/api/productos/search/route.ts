import Fuse from "fuse.js";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const { data: exactData } = await supabase
    .from("products")
    .select("id, name")
    .ilike("name", `%${q}%`)
    .limit(10);

  const exact = (exactData ?? []) as { id: number; name: string }[];

  if (exact.length >= 3) {
    return NextResponse.json(exact);
  }

  // Fuzzy fallback when fewer than 3 exact matches
  const firstLetter = q[0].toUpperCase();
  const { data: candidates } = await supabase
    .from("products")
    .select("id, name")
    .ilike("name", `${firstLetter}%`)
    .limit(300);

  const existingIds = new Set(exact.map((p) => p.id));
  const pool = ((candidates ?? []) as { id: number; name: string }[]).filter(
    (p) => !existingIds.has(p.id)
  );

  const fuse = new Fuse(pool, {
    keys: ["name"],
    threshold: 0.4,
    includeScore: true,
  });

  const fuzzyResults = fuse
    .search(q)
    .filter((r) => (r.score ?? 1) < 0.4)
    .slice(0, 10 - exact.length)
    .map((r) => r.item);

  return NextResponse.json([...exact, ...fuzzyResults]);
}
