import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { findBestMatch, ProductMatch } from "@/lib/product-search";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type MedExtracted = {
  medication_name_primary: string;
  medication_name_alternatives?: string[];
  confidence: "high" | "medium" | "low";
  dosage?: string;
  quantity?: string;
};

type ResultRow = {
  written: string;
  matched: string | null;
  matchedId: number | null;
  confidence: number;
  available: boolean;
  matchStatus: "confirmed" | "review" | "not_found";
  suggestions: ProductMatch[];
};

function extractActiveIngredient(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  const stopIdx = parts.findIndex((p) => /^\d/.test(p));
  const words = stopIdx > 0 ? parts.slice(0, stopIdx) : parts.slice(0, 2);
  return words.join(" ").trim() || nombre.trim();
}

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
  return 74;
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

    const visionResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1536,
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
              text: `Analiza esta receta médica venezolana. Extrae cada medicamento con la siguiente estructura JSON.
Responde ÚNICAMENTE con un array JSON válido, sin texto adicional ni markdown:

[
  {
    "medication_name_primary": "tu mejor lectura del nombre",
    "medication_name_alternatives": ["variante1", "variante2"],
    "confidence": "high",
    "dosage": "dosis si es legible",
    "quantity": "cantidad si está escrita"
  }
]

REGLAS DE TRANSCRIPCIÓN:
- Si la letra es ambigua entre dos posibles palabras, incluye AMBAS en medication_name_alternatives. Ejemplo: si ves "Lepr/nit" incluye "Leprit" y "Lepnit".
- Marca confidence="low" si tienes menos del 70% de seguridad en la lectura.
- Marca confidence="medium" si entre 70-90% de seguridad.
- Considera marcas comerciales venezolanas comunes: Atamel, Pepto, Vick, Nexium, Leprit, Buscapina, Tabcin, Mejoral, Advil, Panadol, Tylenol, Losartán, Atorvastatina, Esomeprazol, Metformina, Omeprazol, Ibuprofeno, Amoxicilina.
- Si una letra puede ser "i", "n" o "u" (común en cursiva manuscrita), genera variantes con cada una en medication_name_alternatives.
- medication_name_primary debe ser el nombre del medicamento sin dosis (solo nombre).
- Si no es una receta o no puedes leerla, responde: []`,
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

    const results: ResultRow[] = await Promise.all(
      medications.map(async (med) => {
        const primaryName = med.medication_name_primary?.trim() ?? "";
        const alternatives = (med.medication_name_alternatives ?? []).filter(
          (a) => a && a.trim() !== primaryName
        );
        const dosage = med.dosage?.trim() ?? "";
        const written = dosage ? `${primaryName} ${dosage}` : primaryName;
        const activeIngredient = extractActiveIngredient(primaryName);

        // Search primary name first
        let searchResult = await findBestMatch(primaryName, activeIngredient);

        // If no exact match, try each alternative
        if (!searchResult.exactMatch && alternatives.length > 0) {
          const altSuggestions: typeof searchResult.suggestions = [];

          for (const alt of alternatives) {
            const altResult = await findBestMatch(alt, extractActiveIngredient(alt));
            if (altResult.exactMatch) {
              searchResult = altResult;
              break;
            }
            altSuggestions.push(...altResult.suggestions);
          }

          // Merge suggestions if still no exact match
          if (!searchResult.exactMatch) {
            const seen = new Set<number>(searchResult.suggestions.map((s) => s.id));
            for (const s of altSuggestions) {
              if (!seen.has(s.id)) {
                seen.add(s.id);
                searchResult.suggestions.push(s);
              }
            }
            searchResult.suggestions = searchResult.suggestions.slice(0, 3);
          }
        }

        const { exactMatch, suggestions } = searchResult;
        const matchStatus = exactMatch
          ? "confirmed"
          : suggestions.length > 0
          ? "review"
          : "not_found";

        return {
          written,
          matched: exactMatch?.name ?? null,
          matchedId: exactMatch?.id ?? null,
          confidence: exactMatch
            ? confidenceScore(activeIngredient, exactMatch.name, written)
            : 0,
          available: exactMatch !== null,
          matchStatus,
          suggestions,
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
