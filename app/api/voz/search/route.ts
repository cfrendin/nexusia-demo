import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { findProductByIngredient } from "@/lib/product-search";

export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Eres un asistente de Farmatodo. Detecta si el usuario está pidiendo:

MODO A — Medicamentos o marcas específicas (ej: 'Atamel, Pepto, ibuprofeno'):
Devuelve: { "mode": "explicit", "items": [{ "query": "<lo que dijo el usuario, tal cual>", "fallback": "<principio activo si es marca>", "dose": "" }] }

IMPORTANTE: Si el usuario dice una marca comercial venezolana (Atamel, Pepto, Vick, Buscapina, Tabcin, Mejoral, Advil, Panadol, Tylenol, Alka-Seltzer, Nexium, Bayaspirina, Aspirina Bayer, Dolofin, Picot, Sal de Uvas, Eno, Milanta, Rinex, Noxa, Dramamine, Loratadina, Hidracort, etc.), MANTÉN la marca en 'query' y pon el principio activo en 'fallback'.

Ejemplos:
- Usuario dice 'dame un Atamel' → { "query": "atamel", "fallback": "acetaminofen", "dose": "" }
- Usuario dice 'necesito Pepto' → { "query": "pepto", "fallback": "subsalicilato bismuto", "dose": "" }
- Usuario dice 'ibuprofeno 400' → { "query": "ibuprofeno", "fallback": "", "dose": "400" }
- Usuario dice 'Buscapina' → { "query": "buscapina", "fallback": "butilhioscina", "dose": "" }
- Usuario dice 'curitas' → { "query": "curitas", "fallback": "", "dose": "" }

MODO B — Síntomas o malestar (ej: 'me duele la cabeza', 'tengo gripe', 'me duele la barriga'):
Devuelve: { "mode": "symptom", "symptom": "<síntoma resumido>", "items": [{ "query": "<medicamento OTC sugerido>", "reason": "<por qué este>" }, ...] }

Reglas para MODO B:
- Solo sugiere medicamentos OTC de venta libre. NUNCA antibióticos, antidepresivos, medicamentos controlados.
- Máximo 3 sugerencias por síntoma.
- Categorías comunes:
  * Dolor de cabeza → acetaminofen, ibuprofeno
  * Dolor de barriga/estómago → antiacido, simeticona, sales de rehidratacion
  * Gripe/resfriado → acetaminofen, descongestionante, vitamina c
  * Fiebre → acetaminofen, ibuprofeno
  * Alergia → loratadina, cetirizina
  * Tos → ambroxol, dextrometorfano
  * Diarrea → loperamida, sales de rehidratacion
  * Acidez → omeprazol, ranitidina, antiacido
- 'reason' debe ser breve, máximo 8 palabras (ej: 'Reduce el dolor y la inflamación')

Solo devuelve JSON. NADA de texto conversacional.
NO des consejo médico. NO diagnostiques.
Si el síntoma sugiere algo grave (dolor en el pecho, dificultad para respirar, sangrado, dolor severo), devuelve: { "mode": "urgent", "message": "Te recomendamos consultar a un médico de inmediato." }`;

type ExplicitItem = { query: string; fallback: string; dose: string };
type SymptomItem = { query: string; reason: string };
type ClaudeResult =
  | { mode: "explicit"; items: ExplicitItem[] }
  | { mode: "symptom"; symptom: string; items: SymptomItem[] }
  | { mode: "urgent"; message: string };

async function findWithFallback(query: string, fallback: string) {
  const primary = await findProductByIngredient(query);
  if (primary) return primary;
  if (fallback?.trim()) return findProductByIngredient(fallback);
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { transcript } = (await req.json()) as { transcript: string };

    if (!transcript?.trim()) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: "user", content: transcript }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text.trim() : "{}";

    let parsed: ClaudeResult | null = null;
    try {
      const cleaned = rawText.replace(/```(?:json)?\n?|\n?```/g, "").trim();
      parsed = JSON.parse(cleaned) as ClaudeResult;
    } catch {
      const m = rawText.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]) as ClaudeResult; } catch { parsed = null; }
      }
    }

    if (!parsed) {
      return NextResponse.json({ error: "No se pudo interpretar la solicitud.", results: [] });
    }

    if (parsed.mode === "urgent") {
      return NextResponse.json({ mode: "urgent", urgent: true, message: parsed.message });
    }

    if (parsed.mode === "symptom") {
      const { symptom, items } = parsed;
      if (!items.length) {
        return NextResponse.json({ error: "No se detectaron sugerencias.", results: [] });
      }
      const results = await Promise.all(
        items.map(async (item) => {
          const product = await findProductByIngredient(item.query);
          return {
            query: item.query,
            reason: item.reason ?? "",
            matched: product?.name ?? null,
            available: product !== null,
          };
        })
      );
      return NextResponse.json({ mode: "symptom", symptom, results });
    }

    // explicit mode — try brand name first, fall back to generic if no match
    const items = (parsed as { mode: "explicit"; items: ExplicitItem[] }).items ?? [];
    if (!items.length) {
      return NextResponse.json({ error: "No se detectaron medicamentos en el audio.", results: [] });
    }
    const results = await Promise.all(
      items.map(async (item) => {
        const product = await findWithFallback(item.query, item.fallback ?? "");
        return {
          query: item.query,
          dose: item.dose ?? "",
          matched: product?.name ?? null,
          available: product !== null,
        };
      })
    );
    return NextResponse.json({ mode: "explicit", results });
  } catch (err) {
    console.error("[/api/voz/search]", err);
    return NextResponse.json({ error: "Error al buscar productos." }, { status: 500 });
  }
}
