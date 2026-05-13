import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;

    if (!audio) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    // Whisper accepts: flac, m4a, mp3, mp4, mpeg, mpga, ogg, wav, webm
    // Rename to .mp4 for iOS Safari compatibility (audio/mp4 blobs)
    const ext = audio.type.includes("mp4") ? "mp4" :
                audio.type.includes("webm") ? "webm" :
                audio.type.includes("ogg") ? "ogg" : "mp4";

    const file = new File([await audio.arrayBuffer()], `audio.${ext}`, {
      type: audio.type || "audio/mp4",
    });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "es",
      prompt: "Farmacia, medicamento, pastillas, jarabe, dosis, Venezuela, Farmatodo",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (err) {
    console.error("[/api/voz/transcribir]", err);
    return NextResponse.json(
      { error: "No se pudo transcribir el audio. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
