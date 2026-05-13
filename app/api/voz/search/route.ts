import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { findProductByIngredient } from "@/lib/product-search";

export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Eres un asistente de Farmatodo. El usuario dictó una lista de medicamentos por voz.
Tu único trabajo es extraer los productos mencionados y devolver un JSON con esta forma exacta:

{ "items": [{ "query": "acetaminofen", "dose": "500mg" }, ...] }

Reglas:
- Solo devuelve JSON válido, NADA de texto conversacional
- "query" es el principio activo limpio en minúsculas (sin dosis, sin marca)
- "dose" es la dosis si el usuario la mencionó, si no, string vacío ""
- Si el usuario dice "curitas" o "banditas", usa query "curitas"
- No hagas preguntas, no pidas confirmación, no expliques nada`;

type ExtractedItem = { query: string; dose: string };

export async function POST(req: NextRequest) {
  try {
    const { transcript } = (await req.json()) as { transcript: string };

    if (!transcript?.trim()) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    // Step 1: Claude extracts medications as structured JSON
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: "user", content: transcript }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text.trim() : "{}";

    let items: ExtractedItem[] = [];
    try {
      const cleaned = rawText.replace(/```(?:json)?\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      items = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
    } catch {
      const m = rawText.match(/\[[\s\S]*\]/);
      if (m) {
        try { items = JSON.parse(m[0]); } catch { items = []; }
      }
    }

    if (!items.length) {
      return NextResponse.json({
        error: "No se detectaron medicamentos en el audio.",
        results: [],
      });
    }

    // Step 2: Search catalog for each item in parallel (same tier ranking as Módulo 1)
    const results = await Promise.all(
      items.map(async (item) => {
        const product = await findProductByIngredient(item.query);
        return {
          query: item.query,
          dose: item.dose ?? "",
          matched: product?.name ?? null,
          available: product !== null,
        };
      })
    );

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[/api/voz/search]", err);
    return NextResponse.json(
      { error: "Error al buscar productos." },
      { status: 500 }
    );
  }
}
