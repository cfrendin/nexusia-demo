"use client";

import { useState, useRef, useEffect } from "react";

type Step = "idle" | "recording" | "transcribing" | "searching" | "results" | "error" | "urgent";

type ProductResult = {
  query: string;
  dose?: string;
  reason?: string;
  matched: string | null;
  available: boolean;
};

function getMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/mp4";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "audio/mp4";
}

export default function VozPage() {
  const [step, setStep] = useState<Step>("idle");
  const [transcript, setTranscript] = useState("");
  const [results, setResults] = useState<ProductResult[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [cart, setCart] = useState<string[]>([]);
  const [recSeconds, setRecSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState(false);
  const [toastCount, setToastCount] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [responseMode, setResponseMode] = useState<"explicit" | "symptom" | "">("");
  const [symptomText, setSymptomText] = useState("");
  const [urgentMsg, setUrgentMsg] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("audio/mp4");

  // Recording timer
  useEffect(() => {
    if (step !== "recording") { setRecSeconds(0); return; }
    const iv = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [step]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getMimeType();
      mimeRef.current = mimeType;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        processAudio();
      };

      recorder.start();
      recorderRef.current = recorder;
      setStep("recording");
    } catch {
      setPermissionDenied(true);
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  };

  const processAudio = async () => {
    setStep("transcribing");
    try {
      // Step A: Whisper transcription
      const mimeType = mimeRef.current;
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const fd = new FormData();
      fd.append("file", blob, `audio.${ext}`);

      const tRes = await fetch("/api/voz/transcribe", { method: "POST", body: fd });
      const tData = await tRes.json();

      if (!tRes.ok || !tData.text?.trim()) {
        setStep("error");
        setErrorMsg(tData.error || "No se escuchó nada. Intenta de nuevo.");
        return;
      }

      const text: string = tData.text.trim();
      setTranscript(text);

      // Step B: Search catalog
      setStep("searching");

      const sRes = await fetch("/api/voz/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const sData = await sRes.json();

      if (sData.urgent) {
        setUrgentMsg(sData.message ?? "Te recomendamos consultar a un médico de inmediato.");
        setStep("urgent");
        return;
      }

      if (!sRes.ok || sData.error || !sData.results?.length) {
        setStep("error");
        setErrorMsg(sData.error || "No se encontraron productos.");
        return;
      }

      setResponseMode(sData.mode ?? "explicit");
      setSymptomText(sData.symptom ?? "");
      const r = sData.results as ProductResult[];
      setResults(r);
      setChecked(r.map((item) => item.available && !!item.matched));
      setStep("results");
    } catch {
      setStep("error");
      setErrorMsg("Error de red. Intenta de nuevo.");
    }
  };

  const handleMic = () => {
    if (permissionDenied) return;
    if (step === "recording") { stopRecording(); return; }
    if (step === "idle") startRecording();
  };

  const toggleCheck = (i: number) => {
    const next = [...checked];
    next[i] = !next[i];
    setChecked(next);
  };

  const handleAddCart = () => {
    const toAdd = results
      .filter((r, i) => checked[i] && r.matched)
      .map((r) => r.matched!);
    if (!toAdd.length) return;
    setToastCount(toAdd.length);
    setCart((prev) => {
      const next = [...prev];
      toAdd.forEach((item) => { if (!next.includes(item)) next.push(item); });
      return next;
    });
    setToast(true);
    setTimeout(() => setToast(false), 2800);
  };

  const handleReset = () => {
    setStep("idle");
    setTranscript("");
    setResults([]);
    setChecked([]);
    setErrorMsg("");
    setResponseMode("");
    setSymptomText("");
    setUrgentMsg("");
  };

  const checkedCount = checked.filter(Boolean).length;
  const timerStr = `${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")}`;
  const showMic = step === "idle" || step === "recording";

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-5 pt-10 pb-4 flex-shrink-0" style={{ background: "#0B3D6B" }}>
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-white/50 text-[10px] uppercase tracking-widest mb-1"
              style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}
            >
              Módulo 02
            </p>
            <h2
              className="text-white text-2xl font-bold leading-tight"
              style={{ fontFamily: "var(--font-plus-jakarta)" }}
            >
              Carrito por Voz
            </h2>
          </div>
          {cart.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(0,165,181,0.25)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00A5B5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.97-1.67L23 6H6" />
              </svg>
              <span className="text-white text-xs font-bold" style={{ fontFamily: "var(--font-dm-sans)" }}>
                {cart.length}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 px-4 py-5 ${showMic ? "pb-36" : "pb-8"}`}>

        {/* IDLE */}
        {step === "idle" && (
          <div className="flex flex-col items-center justify-center gap-4 pt-8">
            {permissionDenied ? (
              <div
                className="w-full rounded-2xl px-4 py-5 text-center"
                style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)" }}
              >
                <p className="text-sm font-semibold mb-1" style={{ color: "#dc2626", fontFamily: "var(--font-plus-jakarta)" }}>
                  Micrófono bloqueado
                </p>
                <p className="text-xs" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)" }}>
                  Ve a Configuración → Safari → Micrófono y permite el acceso.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-center" style={{ color: "#64748b", fontFamily: "var(--font-dm-sans)", maxWidth: 260 }}>
                  Habla con naturalidad. Di los medicamentos que necesitas y los busco en catálogo.
                </p>
                <div
                  className="text-xs text-center px-3 py-2 rounded-xl italic"
                  style={{ background: "rgba(0,165,181,0.07)", color: "#0B3D6B", fontFamily: "var(--font-dm-sans)", border: "1px solid rgba(0,165,181,0.15)" }}
                >
                  "Necesito acetaminofén 500 y loratadina"
                </div>
              </>
            )}
          </div>
        )}

        {/* RECORDING */}
        {step === "recording" && (
          <div className="flex flex-col items-center gap-5 pt-8 animate-fade-up">
            <div
              className="text-4xl font-bold tabular-nums"
              style={{ color: "#dc2626", fontFamily: "var(--font-plus-jakarta)" }}
            >
              {timerStr}
            </div>
            <p className="text-sm" style={{ color: "#64748b", fontFamily: "var(--font-dm-sans)" }}>
              Grabando... Toca para enviar
            </p>
            <div className="flex gap-1.5 items-end h-8">
              {[14, 22, 18, 28, 16, 24, 12].map((h, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full animate-bounce"
                  style={{
                    background: "#dc2626",
                    height: `${h}px`,
                    animationDelay: `${i * 70}ms`,
                    opacity: 0.6 + (i % 2) * 0.3,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* TRANSCRIBING */}
        {step === "transcribing" && (
          <div className="flex flex-col items-center gap-4 pt-10 animate-fade-up">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(0,165,181,0.08)", border: "1px solid rgba(0,165,181,0.15)" }}
            >
              <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00A5B5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: "#0B3D6B", fontFamily: "var(--font-dm-sans)" }}>
              Transcribiendo...
            </p>
            <p className="text-xs" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)" }}>
              Whisper AI · Optimizado para español
            </p>
          </div>
        )}

        {/* SEARCHING — transcript visible immediately + spinner */}
        {step === "searching" && (
          <div className="flex flex-col gap-3 animate-fade-up">
            {/* User message bubble */}
            <div className="flex justify-end">
              <div
                className="max-w-[78%] px-4 py-3 text-sm leading-relaxed"
                style={{
                  background: "#0B3D6B",
                  color: "white",
                  fontFamily: "var(--font-dm-sans)",
                  borderRadius: "18px 18px 4px 18px",
                }}
              >
                {transcript}
              </div>
            </div>
            {/* Search indicator */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: "rgba(0,165,181,0.06)", border: "1px solid rgba(0,165,181,0.14)" }}
            >
              <svg className="animate-spin flex-shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00A5B5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              <p className="text-sm" style={{ color: "#0B3D6B", fontFamily: "var(--font-dm-sans)" }}>
                Buscando en catálogo Farmatodo...
              </p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {step === "error" && (
          <div className="flex flex-col gap-3 animate-fade-up">
            {transcript && (
              <div className="flex justify-end">
                <div
                  className="max-w-[78%] px-4 py-3 text-sm"
                  style={{ background: "#0B3D6B", color: "white", fontFamily: "var(--font-dm-sans)", borderRadius: "18px 18px 4px 18px" }}
                >
                  {transcript}
                </div>
              </div>
            )}
            <div
              className="flex flex-col items-center gap-3 rounded-2xl py-6 px-4 text-center"
              style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm font-medium" style={{ color: "#dc2626", fontFamily: "var(--font-dm-sans)" }}>
                {errorMsg}
              </p>
              <button
                onClick={handleReset}
                className="text-sm font-semibold px-5 py-2 rounded-xl"
                style={{ background: "#0B3D6B", color: "white", fontFamily: "var(--font-dm-sans)" }}
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        )}

        {/* URGENT */}
        {step === "urgent" && (
          <div className="flex flex-col gap-3 animate-fade-up">
            {transcript && (
              <div className="flex justify-end">
                <div
                  className="max-w-[78%] px-4 py-3 text-sm"
                  style={{ background: "#0B3D6B", color: "white", fontFamily: "var(--font-dm-sans)", borderRadius: "18px 18px 4px 18px" }}
                >
                  {transcript}
                </div>
              </div>
            )}
            <div
              className="flex flex-col items-center gap-3 rounded-2xl py-6 px-4 text-center"
              style={{ background: "rgba(220,38,38,0.06)", border: "2px solid rgba(220,38,38,0.25)" }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-sm font-semibold leading-snug" style={{ color: "#dc2626", fontFamily: "var(--font-plus-jakarta)" }}>
                {urgentMsg}
              </p>
              <p className="text-xs" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)" }}>
                Llama al 171 o acude al centro de salud más cercano.
              </p>
              <button
                onClick={handleReset}
                className="text-sm font-semibold px-5 py-2 rounded-xl"
                style={{ background: "#0B3D6B", color: "white", fontFamily: "var(--font-dm-sans)" }}
              >
                Nueva consulta
              </button>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {step === "results" && (
          <div className="flex flex-col gap-3 animate-fade-up">
            {/* Transcript bubble */}
            <div className="flex justify-end">
              <div
                className="max-w-[78%] px-4 py-3 text-sm leading-relaxed"
                style={{
                  background: "#0B3D6B",
                  color: "white",
                  fontFamily: "var(--font-dm-sans)",
                  borderRadius: "18px 18px 4px 18px",
                }}
              >
                {transcript}
              </div>
            </div>

            {responseMode === "symptom" && symptomText && (
              <div className="px-1 pt-1 pb-0.5">
                <p className="text-sm font-semibold" style={{ color: "#0B3D6B", fontFamily: "var(--font-plus-jakarta)" }}>
                  Para &ldquo;{symptomText}&rdquo; te sugerimos:
                </p>
              </div>
            )}

            <p
              className="text-xs uppercase tracking-widest px-1"
              style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)", letterSpacing: "0.1em" }}
            >
              {results.length} producto{results.length !== 1 ? "s" : ""} encontrado{results.length !== 1 ? "s" : ""}
            </p>

            {/* Product cards */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(11,61,107,0.08)", boxShadow: "0 1px 4px rgba(11,61,107,0.06)" }}
            >
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`bg-white px-3 py-3 flex items-start gap-3 ${i < results.length - 1 ? "border-b" : ""}`}
                  style={{ borderColor: "rgba(11,61,107,0.06)" }}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => r.matched && toggleCheck(i)}
                    disabled={!r.matched}
                    className="flex-shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center transition-colors"
                    style={{
                      background: checked[i] ? "#0B3D6B" : "white",
                      border: `2px solid ${checked[i] ? "#0B3D6B" : "#cbd5e1"}`,
                    }}
                  >
                    {checked[i] && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] mb-0.5" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)" }}>
                      &ldquo;{r.query}{r.dose ? ` ${r.dose}` : ""}&rdquo;
                    </p>
                    <p className="text-xs font-semibold leading-snug" style={{ color: "#1a2332", fontFamily: "var(--font-dm-sans)" }}>
                      {r.matched ?? "Sin coincidencia en catálogo"}
                    </p>
                    {r.reason && (
                      <p className="text-[10px] mt-0.5 leading-tight" style={{ color: "#64748b", fontFamily: "var(--font-dm-sans)" }}>
                        {r.reason}
                      </p>
                    )}
                  </div>

                  {/* Status chip */}
                  <div className="flex-shrink-0 mt-0.5">
                    {r.matched ? (
                      <span className="chip-available">Disponible</span>
                    ) : (
                      <span className="chip-unavailable">No encontrado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add to cart */}
            {checkedCount > 0 && (
              <button
                onClick={handleAddCart}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] duration-150"
                style={{ background: "#0B3D6B", color: "white", fontFamily: "var(--font-plus-jakarta)" }}
              >
                Agregar al carrito ({checkedCount})
              </button>
            )}

            {/* Nueva búsqueda */}
            <button
              onClick={handleReset}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
              style={{ background: "rgba(11,61,107,0.06)", color: "#0B3D6B", fontFamily: "var(--font-dm-sans)" }}
            >
              Nueva búsqueda
            </button>

            {responseMode === "symptom" && (
              <div
                className="flex items-start gap-2 p-3 rounded-xl"
                style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.25)" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a16207" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className="text-xs leading-relaxed" style={{ color: "#a16207", fontFamily: "var(--font-dm-sans)" }}>
                  Sugerencias basadas en síntomas. Consulta con tu farmacéutico para tratamiento adecuado.
                </p>
              </div>
            )}

            <div
              className="flex items-start gap-2 p-3 rounded-xl"
              style={{ background: "rgba(26,122,181,0.06)", border: "1px solid rgba(26,122,181,0.12)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A7AB5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs leading-relaxed" style={{ color: "#1A7AB5", fontFamily: "var(--font-dm-sans)" }}>
                Validación farmacéutica antes de despacho
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mic button — only in idle + recording */}
      {showMic && (
        <div
          className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 py-4 flex flex-col items-center gap-2"
          style={{ background: "rgba(240,244,248,0.95)", backdropFilter: "blur(8px)" }}
        >
          <button
            onClick={handleMic}
            disabled={permissionDenied}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-40"
            style={{
              background: step === "recording" ? "#dc2626" : "#0B3D6B",
              boxShadow:
                step === "recording"
                  ? "0 0 0 10px rgba(220,38,38,0.12)"
                  : "0 4px 20px rgba(11,61,107,0.35)",
              animation: step === "recording" ? "pulseMic 1.5s ease-in-out infinite" : "none",
            }}
          >
            {step === "recording" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
          <p className="text-xs" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)" }}>
            {step === "recording" ? "Toca para enviar" : "Toca para hablar"}
          </p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-white text-sm font-medium flex items-center gap-2 animate-slide-up"
          style={{
            background: "#16a34a",
            boxShadow: "0 4px 20px rgba(22,163,74,0.4)",
            fontFamily: "var(--font-dm-sans)",
            maxWidth: "calc(100% - 32px)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toastCount} producto{toastCount !== 1 ? "s" : ""} agregado{toastCount !== 1 ? "s" : ""} al carrito
        </div>
      )}
    </div>
  );
}
