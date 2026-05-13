import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { name, medication, nextRefill, store, adherence } = await req.json();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Genera un mensaje de WhatsApp para recordarle a un paciente sobre su medicamento.
Datos del paciente:
- Nombre: ${name}
- Medicamento: ${medication}
- Próxima recarga: ${nextRefill}
- Tienda: ${store}
- Adherencia actual: ${adherence}%

El mensaje debe:
- Ser en español venezolano natural y cálido (tutear o tratar de usted según el nombre)
- Máximo 2 oraciones
- Mencionar la tienda Farmatodo específica
- Incluir 1-2 emojis apropiados
- No sonar robótico

Responde SOLO con el mensaje, sin comillas ni etiquetas extra.`,
        },
      ],
    });

    const mensaje =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : `Hola ${name}! Tu ${medication} vence en ${nextRefill}. Pásate por ${store} 💊`;

    return NextResponse.json({ mensaje });
  } catch (err) {
    console.error("[/api/cronicos/mensaje]", err);
    return NextResponse.json(
      { error: "Error al generar el mensaje" },
      { status: 500 }
    );
  }
}
