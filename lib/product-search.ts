import Fuse from "fuse.js";
import { supabase } from "@/lib/supabase";

type ProductRow = { id: number; name: string; generic_name: string | null };

export type ProductMatch = { id: number; name: string };

export type SearchResult = {
  exactMatch: ProductMatch | null;
  suggestions: ProductMatch[];
};

const isCombo = (row: ProductRow) =>
  (!!row.generic_name && row.generic_name.includes("+")) || row.name.includes("+");

function tier(row: ProductRow, query: string): number {
  const q = query.toLowerCase();
  const g = (row.generic_name ?? "").toLowerCase().trim();
  const combo = isCombo(row);
  const n = row.name.toLowerCase();

  if (g === q && !combo) return 1;
  if (g.startsWith(q) && !combo) return 2;
  if (n.startsWith(q) && !combo) return 3;
  if (n.includes(q) && !combo) return 4;
  if (!combo) return 5;
  return 6;
}

function pickBest(rows: ProductRow[], query: string): ProductRow | null {
  if (!rows.length) return null;
  return rows.reduce((best, r) =>
    tier(r, query) < tier(best, query) ? r : best
  );
}

async function fuzzyFallback(term: string): Promise<ProductMatch[]> {
  const firstLetter = term[0]?.toUpperCase() ?? "";
  if (!firstLetter) return [];

  const { data: candidates } = await supabase
    .from("products")
    .select("id, name")
    .ilike("name", `${firstLetter}%`)
    .limit(300);

  if (!candidates?.length) return [];

  // Filter by first-word length ±3 to narrow the fuzzy pool
  const termLen = term.length;
  const pool = (candidates as { id: number; name: string }[]).filter((p) => {
    const firstWord = p.name.split(/\s+/)[0] ?? "";
    return Math.abs(firstWord.length - termLen) <= 3;
  });

  const fuse = new Fuse(pool, {
    keys: ["name"],
    threshold: 0.4,
    includeScore: true,
  });

  return fuse
    .search(term)
    .filter((r) => (r.score ?? 1) < 0.4)
    .slice(0, 3)
    .map((r) => ({ id: r.item.id, name: r.item.name }));
}

export async function findProductByIngredient(
  activeIngredient: string
): Promise<{ name: string } | null> {
  const SELECT = "id, name, generic_name";

  const [{ data: byExact }, { data: byName }] = await Promise.all([
    supabase.from("products").select(SELECT).ilike("generic_name", activeIngredient).order("name").limit(10),
    supabase.from("products").select(SELECT).ilike("name", `%${activeIngredient}%`).order("name").limit(10),
  ]);

  const combined = [...(byExact ?? []), ...(byName ?? [])] as ProductRow[];
  const best = pickBest(combined, activeIngredient);
  if (best) return best;

  const { data: byGeneric } = await supabase
    .from("products").select(SELECT).ilike("generic_name", `%${activeIngredient}%`).order("name").limit(10);

  const bestGeneric = pickBest((byGeneric ?? []) as ProductRow[], activeIngredient);
  if (bestGeneric) return bestGeneric;

  const prefix = activeIngredient.slice(0, 5);
  if (prefix.length < 4) return null;

  const { data: byPrefix } = await supabase
    .from("products").select(SELECT).ilike("name", `%${prefix}%`).order("name").limit(10);

  return pickBest((byPrefix ?? []) as ProductRow[], prefix);
}

export async function findBestMatch(
  query: string,
  fallback: string
): Promise<SearchResult> {
  const q = query.trim();

  // Tier 1: query in name, single drug
  const { data: t1 } = await supabase
    .from("products").select("id, name").ilike("name", `%${q}%`).not("name", "ilike", "%+%").limit(5);
  if ((t1 as ProductMatch[] | null)?.length) {
    const r = (t1 as ProductMatch[])[0];
    return { exactMatch: { id: r.id, name: r.name }, suggestions: [] };
  }

  // Tier 2: query in name, combos allowed
  const { data: t2 } = await supabase
    .from("products").select("id, name").ilike("name", `%${q}%`).limit(5);
  if ((t2 as ProductMatch[] | null)?.length) {
    const r = (t2 as ProductMatch[])[0];
    return { exactMatch: { id: r.id, name: r.name }, suggestions: [] };
  }

  const fb = fallback?.trim();
  if (fb && fb !== q) {
    // Tier 3: fallback in name, single drug
    const { data: t3 } = await supabase
      .from("products").select("id, name").ilike("name", `%${fb}%`).not("name", "ilike", "%+%").limit(5);
    if ((t3 as ProductMatch[] | null)?.length) {
      const r = (t3 as ProductMatch[])[0];
      return { exactMatch: { id: r.id, name: r.name }, suggestions: [] };
    }

    // Tier 4: fallback in name, combos allowed
    const { data: t4 } = await supabase
      .from("products").select("id, name").ilike("name", `%${fb}%`).limit(5);
    if ((t4 as ProductMatch[] | null)?.length) {
      const r = (t4 as ProductMatch[])[0];
      return { exactMatch: { id: r.id, name: r.name }, suggestions: [] };
    }
  }

  // Fuzzy fallback: combine suggestions from both query and fallback
  const [primSuggs, fbSuggs] = await Promise.all([
    fuzzyFallback(q),
    fb && fb !== q ? fuzzyFallback(fb) : Promise.resolve([]),
  ]);

  const seen = new Set<number>();
  const merged: ProductMatch[] = [];
  for (const s of [...primSuggs, ...fbSuggs]) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      merged.push(s);
      if (merged.length >= 3) break;
    }
  }

  return { exactMatch: null, suggestions: merged };
}

export function extractActiveIngredient(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  const stopIdx = parts.findIndex((p) => /^\d/.test(p));
  const words = stopIdx > 0 ? parts.slice(0, stopIdx) : parts.slice(0, 2);
  return words.join(" ").trim() || nombre.trim();
}
