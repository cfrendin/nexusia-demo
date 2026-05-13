"use client";

import { useState, useRef, useEffect } from "react";

type Role = "user" | "bot";
interface Message { role: Role; text: string }
type MicState = "idle" | "recording" | "transcribing" | "thinking";

function getBestMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/mp4";
  const types = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "audio/mp4";
}

export default function VozPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [cart, setCart] = useState<string[]>([]);
  const [micState, setMicState] = useState<MicState>("idle");
  const [statusLabel, setStatusLabel] = useState("Powered by voz — habla, la IA busca en catálogo");
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, micState]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getBestMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        processAudio(mimeType);
      };

      recorder.start();
      recorderRef.current = recorder;
      setMicState("recording");
      setStatusLabel("Grabando... Toca para enviar");
    } catch {
      setPermissionDenied(true);
      setStatusLabel("Permite el acceso al micrófono");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setMicState("transcribing");
    setStatusLabel("Transcribiendo...");
  };

  const processAudio = async (mimeType: string) => {
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });

      // 1. Transcribe with Whisper
      const fd = new FormData();
      fd.append("audio", blob, "audio.mp4");
      const tRes = await fetch("/api/voz/transcribir", { method: "POST", body: fd });
      const tData = await tRes.json();

      if (tData.error || !tData.text?.trim()) {
        setMicState("idle");
        setStatusLabel("No se escuchó nada. Intenta de nuevo.");
        setTimeout(() => setStatusLabel("Powered by voz — habla, la IA busca en catálogo"), 3000);
        return;
      }

      const userText: string = tData.text.trim();
      const newUserMsg: Message = { role: "user", text: userText };
      const updatedMessages = [...messages, newUserMsg];
      setMessages(updatedMessages);
      setMicState("thinking");
      setStatusLabel("Procesando...");

      // 2. Get Claude response
      const cRes = await fetch("/api/voz/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: messages,
        }),
      });
      const cData = await cRes.json();

      const botText: string = cData.error
        ? "Lo siento, tuve un problema. ¿Puedes repetir?"
        : cData.reply;

      setMessages([...updatedMessages, { role: "bot", text: botText }]);

      if (cData.cartItem) {
        setCart((prev) =>
          prev.includes(cData.cartItem) ? prev : [...prev, cData.cartItem]
        );
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Ups, algo falló. ¿Intentamos de nuevo?" },
      ]);
    } finally {
      setMicState("idle");
      setStatusLabel("Powered by voz — habla, la IA busca en catálogo");
    }
  };

  const handleMic = () => {
    if (permissionDenied) return;
    if (micState === "recording") { stopRecording(); return; }
    if (micState !== "idle") return;
    startRecording();
  };

  const handleReset = () => {
    setMessages([]);
    setCart([]);
    setMicState("idle");
    setStatusLabel("Powered by voz — habla, la IA busca en catálogo");
    setPermissionDenied(false);
  };

  const micBg =
    micState === "recording" ? "#dc2626" :
    micState === "transcribing" || micState === "thinking" ? "#1A7AB5" :
    "#0B3D6B";

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <div className="px-5 pt-10 pb-4 flex-shrink-0" style={{ background: "#0B3D6B" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-widest mb-1" style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}>
              Módulo 02
            </p>
            <h2 className="text-white text-2xl font-bold leading-tight" style={{ fontFamily: "var(--font-plus-jakarta)" }}>
              Carrito por Voz
            </h2>
          </div>
          {messages.length > 0 && (
            <button onClick={handleReset} className="text-white/50 text-xs" style={{ fontFamily: "var(--font-dm-sans)" }}>
              Limpiar
            </button>
          )}
        </div>

        {/* Mini cart */}
        {cart.length > 0 && (
          <div className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.1)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A5B5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.97-1.67L23 6H6" />
            </svg>
            <div className="flex-1 min-w-0">
              {cart.map((item, i) => (
                <p key={i} className="text-white text-xs font-medium truncate" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  {item}
                </p>
              ))}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "#00A5B5", color: "white", fontFamily: "var(--font-dm-sans)" }}>
              {cart.length}
            </span>
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-36 space-y-3" style={{ background: "#F0F4F8" }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-10">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(0,165,181,0.12)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00A5B5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: "#475569", fontFamily: "var(--font-plus-jakarta)" }}>
              {permissionDenied ? "Permite el acceso al micrófono en tu browser" : "Toca el micrófono para empezar"}
            </p>
            <p className="text-xs" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)" }}>
              {permissionDenied ? "Ve a Configuración → Safari → Micrófono" : "Habla con naturalidad. La IA busca en catálogo Farmatodo real."}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-slide-up`}>
            {msg.role === "bot" && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center mr-2 flex-shrink-0 self-end mb-0.5" style={{ background: "#0B3D6B" }}>
                <span style={{ fontFamily: "var(--font-plus-jakarta)", fontWeight: 800, fontSize: 10, color: "white" }}>N</span>
              </div>
            )}
            <div
              className="max-w-[78%] px-3.5 py-2.5 text-sm leading-relaxed"
              style={{
                background: msg.role === "user" ? "#0B3D6B" : "white",
                color: msg.role === "user" ? "white" : "#1a2332",
                fontFamily: "var(--font-dm-sans)",
                boxShadow: msg.role === "bot" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {(micState === "thinking") && (
          <div className="flex justify-start animate-slide-up">
            <div className="w-7 h-7 rounded-full flex items-center justify-center mr-2 flex-shrink-0" style={{ background: "#0B3D6B" }}>
              <span style={{ fontFamily: "var(--font-plus-jakarta)", fontWeight: 800, fontSize: 10, color: "white" }}>N</span>
            </div>
            <div className="px-4 py-3 flex gap-1.5 items-center" style={{ background: "white", borderRadius: "18px 18px 18px 4px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Mic controls */}
      <div
        className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 py-3 flex flex-col items-center gap-2"
        style={{ background: "rgba(240,244,248,0.95)", backdropFilter: "blur(8px)" }}
      >
        <p className="text-xs text-center" style={{ color: micState === "idle" ? "#94a3b8" : "#0B3D6B", fontFamily: "var(--font-dm-sans)" }}>
          {statusLabel}
        </p>

        <button
          onClick={handleMic}
          disabled={micState === "transcribing" || micState === "thinking" || permissionDenied}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-50"
          style={{
            background: micBg,
            boxShadow: micState === "recording"
              ? "0 0 0 8px rgba(220,38,38,0.15)"
              : "0 4px 20px rgba(11,61,107,0.35)",
            animation: micState === "recording" ? "pulseMic 1.5s ease-in-out infinite" : "none",
          }}
        >
          {micState === "recording" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : micState === "transcribing" || micState === "thinking" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
