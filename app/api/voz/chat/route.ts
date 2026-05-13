import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Message = { role: "user" | "bot"; text: string };

const SYSTEM_PROMPT = `Eres un asistente de farmacia de Farmatodo Venezuela. Tu nombre es Farma.
Ayudas a los clientes a encontrar medicamentos y agregar productos a su carrito.
Responde siempre en español venezolano natural y amigable. Máximo 2-3 oraciones por respuesta.

Cuando el cliente pida un medicamento o producto:
1. Usa los productos del catálogo que te doy en el contexto (campo PRODUCTOS)
2. Sugiere máximo 3 opciones del catálogo
3. Cuando el cliente confirme cuál quiere, inclúyelo así al final: [AGREGAR:NOMBRE_EXACTO_PRODUCTO]

Responde SOLO con el texto del mensaje. No incluyas JSON ni etiquetas extra, solo el texto natural
y opcionalmente [AGREGAR:X] al final si se confirma agregar un producto.`;

async function searchProducts(query: string): Promise<string[]> {
  if (!query || query.length < 3) return [];
  const { data } = await supabase
    .from("products")
    .select("name")
    .or(`name.ilike.%${query}%,generic_name.ilike.%${query}%`)
    .eq("active", true)
    .limit(5);
  return data?.map((p: { name: string }) => p.name) ?? [];
}

// Extract likely product keywords from user message
function extractKeywords(text: string): string {
  const stopWords = ["necesito", "quiero", "busco", "dame", "tienes", "algo", "para", "el", "la", "los", "las", "un", "una", "me", "mi", "y", "también", "también"];
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.includes(w));
  return words.slice(0, 3).join(" ");
}

export async function POST(req: NextRequest) {
  try {
    const { message, history } = (await req.json()) as {
      message: string;
      history: Message[];
    };

    // Search for relevant products based on the message
    const keywords = extractKeywords(message);
    const products = keywords ? await searchProducts(keywords) : [];

    const productContext = products.length > 0
      ? `\nPRODUCTOS disponibles en catálogo para esta consulta:\n${products.map(p => `- ${p}`).join("\n")}`
      : "";

    // Build messages for Claude
    const claudeMessages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));

    claudeMessages.push({
      role: "user",
      content: message + productContext,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    const reply =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract cart item if Claude included [AGREGAR:X]
    const cartMatch = reply.match(/\[AGREGAR:([^\]]+)\]/);
    const cartItem = cartMatch ? cartMatch[1].trim() : null;
    const cleanReply = reply.replace(/\[AGREGAR:[^\]]+\]/g, "").trim();

    return NextResponse.json({ reply: cleanReply, cartItem });
  } catch (err) {
    console.error("[/api/voz/chat]", err);
    return NextResponse.json(
      { error: "Error al procesar tu mensaje. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
