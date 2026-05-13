import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { findBestMatch } from "@/lib/product-search";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type MedExtracted = {
  nombre: string;
  marca?: string;
  dosis?: string;
  presentacion?: string;
};

type ResultRow = {
  written: string;
  matched: string | null;
  confidence: number;
  available: boolean;
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
[{"nombre": "nombre genérico", "marca": "marca comercial si se menciona, si no vacío", "dosis": "dosis y unidad", "presentacion": "forma farmacéutica"}]
Ejemplos:
- "Atamel 500mg tabletas" → {"nombre":"Acetaminofén","marca":"atamel","dosis":"500 mg","presentacion":"tabletas"}
- "Metformina 850mg" → {"nombre":"Metformina","marca":"","dosis":"850 mg","presentacion":"tabletas"}
- "Nexium 20mg" → {"nombre":"Esomeprazol","marca":"nexium","dosis":"20 mg","presentacion":"cápsulas"}
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

    const results: ResultRow[] = await Promise.all(
      medications.map(async (med) => {
        const rawNombre = med.nombre?.trim() ?? "";
        const rawDosis = med.dosis?.trim() ?? "";
        const activeIngredient = extractActiveIngredient(rawNombre);
        const marca = med.marca?.trim().toLowerCase() ?? "";
        const written = rawDosis ? `${rawNombre} ${rawDosis}` : rawNombre;

        // Search by brand name first (tier 1-2), fall back to generic (tier 3-4)
        const searchQuery = marca || activeIngredient;
        const product = await findBestMatch(searchQuery, activeIngredient);

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
