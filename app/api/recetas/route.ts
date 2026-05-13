import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type MedExtracted = { nombre: string; dosis?: string; presentacion?: string };

type ResultRow = {
  written: string;
  matched: string | null;
  confidence: number;
  available: boolean;
};

// "Esomeprazol 20 mg" → "Esomeprazol"
// "Losartan potásico 50mg" → "Losartan potásico"
function extractActiveIngredient(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  // Stop at the first token that begins with a digit
  const stopIdx = parts.findIndex((p) => /^\d/.test(p));
  const words = stopIdx > 0 ? parts.slice(0, stopIdx) : parts.slice(0, 2);
  return words.join(" ").trim() || nombre.trim();
}

// Extract dose string for confidence scoring: "20 mg" → "20mg"
function normalizeDose(text: string): string {
  const m = text.match(/\d+\s*(?:mg|g|ml|mcg|ui|iu)/i);
  return m ? m[0].replace(/\s+/g, "").toLowerCase() : "";
}

function confidenceScore(
  activeIngredient: string,
  productName: string,
  doseRaw: string
): number {
  const p = productName.toLowerCase();
  const a = activeIngredient.toLowerCase();
  const dose = normalizeDose(doseRaw);

  const startsWith = p.startsWith(a);
  const contains = p.includes(a);
  const doseMatch =
    dose.length > 0 && productName.toLowerCase().replace(/\s/g, "").includes(dose);

  if (startsWith && doseMatch) return 96;
  if (startsWith) return 91;
  if (contains && doseMatch) return 87;
  if (contains) return 82;
  return 74; // prefix-only match
}

type ProductRow = { name: string; generic_name: string | null };

// Returns true when a generic_name string represents a combination drug
const isCombo = (g: string | null) => !!g && g.includes("+");

// Assign a ranking tier — lower is better
function tier(row: ProductRow, activeIngredient: string): number {
  const a = activeIngredient.toLowerCase();
  const g = (row.generic_name ?? "").toLowerCase().trim();
  const combo = isCombo(row.generic_name);

  if (g === a && !combo) return 1;                    // exact generic, single drug
  if (g.startsWith(a) && !combo) return 2;            // generic starts with, single drug
  if (row.name.toLowerCase().includes(a) && !combo) return 3; // name contains, single drug
  if (!combo) return 4;                               // any single-drug match
  return 5;                                           // combo fallback
}

function pickBest(rows: ProductRow[], activeIngredient: string): ProductRow | null {
  if (!rows.length) return null;
  return rows.reduce((best, r) =>
    tier(r, activeIngredient) < tier(best, activeIngredient) ? r : best
  );
}

async function findProduct(
  activeIngredient: string
): Promise<{ name: string } | null> {
  const SELECT = "name, generic_name";

  // Run exact generic_name match and fuzzy name match in parallel
  const [{ data: byExact }, { data: byName }] = await Promise.all([
    supabase
      .from("products")
      .select(SELECT)
      .ilike("generic_name", activeIngredient) // exact (no wildcards)
      .order("name")
      .limit(10),
    supabase
      .from("products")
      .select(SELECT)
      .ilike("name", `%${activeIngredient}%`)
      .order("name")
      .limit(10),
  ]);

  const combined = [...(byExact ?? []), ...(byName ?? [])] as ProductRow[];
  const best = pickBest(combined, activeIngredient);
  if (best) return best;

  // Fuzzy fallback: search generic_name
  const { data: byGeneric } = await supabase
    .from("products")
    .select(SELECT)
    .ilike("generic_name", `%${activeIngredient}%`)
    .order("name")
    .limit(10);

  const bestGeneric = pickBest((byGeneric ?? []) as ProductRow[], activeIngredient);
  if (bestGeneric) return bestGeneric;

  // Prefix fallback (first 5 chars)
  const prefix = activeIngredient.slice(0, 5);
  if (prefix.length < 4) return null;

  const { data: byPrefix } = await supabase
    .from("products")
    .select(SELECT)
    .ilike("name", `%${prefix}%`)
    .order("name")
    .limit(10);

  return pickBest((byPrefix ?? []) as ProductRow[], prefix);
}

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
    }

    const rawType = match[1] as string;
    const base64Data = match[2] as string;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const mediaType = (allowed.includes(rawType) ? rawType : "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    // Claude Vision — extract medications
    const visionResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data },
            },
            {
              type: "text",
              text: `Analiza esta receta médica. Extrae cada medicamento.
Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown:
[{"nombre": "nombre genérico solo (sin marca)", "dosis": "dosis y unidad", "presentacion": "forma farmacéutica"}]
Ejemplo: [{"nombre":"Metformina","dosis":"850 mg","presentacion":"tabletas"}]
Si no es una receta o no puedes leerla, responde: []`,
            },
          ],
        },
      ],
    });

    const rawText =
      visionResponse.content[0].type === "text"
        ? visionResponse.content[0].text.trim()
        : "[]";

    let medications: MedExtracted[] = [];
    try {
      const cleaned = rawText.replace(/```(?:json)?\n?|\n?```/g, "").trim();
      medications = JSON.parse(cleaned);
    } catch {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try { medications = JSON.parse(jsonMatch[0]); } catch { medications = []; }
      }
    }

    if (!Array.isArray(medications) || medications.length === 0) {
      return NextResponse.json({
        results: [],
        error: "No se detectaron medicamentos. Asegurate de que la foto sea clara.",
      });
    }

    // Search Supabase for each extracted medication
    const results: ResultRow[] = await Promise.all(
      medications.map(async (med) => {
        const rawNombre = med.nombre?.trim() ?? "";
        const rawDosis = med.dosis?.trim() ?? "";
        const activeIngredient = extractActiveIngredient(rawNombre);
        const written = rawDosis ? `${rawNombre} ${rawDosis}` : rawNombre;

        const product = await findProduct(activeIngredient);

        return {
          written,
          matched: product?.name ?? null,
          confidence: product
            ? confidenceScore(activeIngredient, product.name, written)
            : 0,
          available: product !== null,
        };
      })
    );

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[/api/recetas]", err);
    return NextResponse.json(
      { error: "Error al procesar la receta. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
