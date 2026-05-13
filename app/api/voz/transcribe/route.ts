import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    // Derive extension from filename or MIME type — Whisper requires a recognizable extension
    const ext = file.name.endsWith("mp4") || file.type.includes("mp4") ? "mp4" : "webm";

    const audioFile = new File([await file.arrayBuffer()], `audio.${ext}`, {
      type: file.type || "audio/mp4",
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "es",
      prompt: "Farmacia, medicamento, pastillas, jarabe, dosis, Venezuela, Farmatodo",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (err) {
    console.error("[/api/voz/transcribe]", err);
    return NextResponse.json(
      { error: "No se pudo transcribir el audio." },
      { status: 500 }
    );
  }
}
