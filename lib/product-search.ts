import { supabase } from "@/lib/supabase";

type ProductRow = { name: string; generic_name: string | null };

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

export async function findProductByIngredient(
  activeIngredient: string
): Promise<{ name: string } | null> {
  const SELECT = "name, generic_name";

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

export function extractActiveIngredient(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  const stopIdx = parts.findIndex((p) => /^\d/.test(p));
  const words = stopIdx > 0 ? parts.slice(0, stopIdx) : parts.slice(0, 2);
  return words.join(" ").trim() || nombre.trim();
}
