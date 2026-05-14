import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { name, medication, daysUntilRefill } = await req.json();

    const days = Number(daysUntilRefill);
    const situacion =
      days < 0
        ? `ya se le venció hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? "s" : ""}`
        : days === 0
        ? "vence hoy"
        : `vence en ${days} día${days !== 1 ? "s" : ""}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Genera un mensaje de WhatsApp corto (máximo 3 líneas, tono cercano venezolano, sin emojis excesivos) para recordarle a ${name} que su ${medication} ${situacion}. Ofrece pedirlo con delivery o recoger en tienda Farmatodo. No uses "estimado/a" ni lenguaje formal. Usa "hola" o el nombre directo. Responde SOLO con el mensaje, sin comillas ni etiquetas extra.`,
        },
      ],
    });

    const mensaje =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : `Hola ${name}! Tu ${medication} ${situacion}. ¿Lo pedimos con delivery o pasas por Farmatodo? 💊`;

    return NextResponse.json({ mensaje });
  } catch (err) {
    console.error("[/api/cronicos/mensaje]", err);
    return NextResponse.json(
      { error: "Error al generar el mensaje" },
      { status: 500 }
    );
  }
}
