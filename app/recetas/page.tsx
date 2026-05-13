"use client";

import { useState, useRef } from "react";

type State = "idle" | "processing" | "results" | "error";

type ResultRow = {
  written: string;
  matched: string | null;
  confidence: number;
  available: boolean;
};

export default function RecetasPage() {
  const [state, setState] = useState<State>("idle");
  const [results, setResults] = useState<ResultRow[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Compress image to max 1400px / 85% JPEG to stay under Vercel's 4.5MB body limit
  const compressImage = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1400;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(dataUrl); // fallback: send original
      img.src = dataUrl;
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState("processing");
    setErrorMsg("");
    setCartAdded(false);

    try {
      // Convert to base64 then compress
      const raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64 = await compressImage(raw);

      const res = await fetch("/api/recetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Error del servidor");
      }

      if (!data.results || data.results.length === 0) {
        setState("error");
        setErrorMsg("No se detectaron medicamentos. Asegurate de que la foto sea clara.");
        return;
      }

      setResults(data.results);
      setState("results");
    } catch (err: unknown) {
      setState("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Error al procesar la receta."
      );
    } finally {
      // Reset file input so the same file can be re-selected
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleUploadTap = () => {
    if (state === "results" || state === "error") {
      setState("idle");
      setResults([]);
      setErrorMsg("");
      setCartAdded(false);
      return;
    }
    fileRef.current?.click();
  };

  const handleAddCart = () => {
    setCartAdded(true);
    setToast(true);
    setTimeout(() => setToast(false), 2800);
  };

  const availableResults = results.filter((r) => r.available && r.matched);

  return (
    <div className="flex flex-col min-h-full">
      {/* Hidden file input — camera on mobile */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Page header */}
      <div className="px-5 pt-10 pb-5" style={{ background: "#0B3D6B" }}>
        <p
          className="text-white/50 text-[10px] uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}
        >
          Módulo 01
        </p>
        <h2
          className="text-white text-2xl font-bold leading-tight"
          style={{ fontFamily: "var(--font-plus-jakarta)" }}
        >
          Lector de Recetas
        </h2>
        <p
          className="text-white/60 text-sm mt-1"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Foto → catálogo Farmatodo en segundos
        </p>
      </div>

      {/* Scan area */}
      <div className="px-4 pt-5">
        {state === "idle" && (
          <button
            onClick={handleUploadTap}
            className="w-full flex flex-col items-center justify-center gap-3 rounded-2xl py-10 transition-all active:scale-[0.98] duration-150"
            style={{ border: "2px dashed #00A5B5", background: "rgba(0,165,181,0.04)" }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,165,181,0.1)" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00A5B5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm" style={{ color: "#0B3D6B", fontFamily: "var(--font-plus-jakarta)" }}>
                Tomar foto de receta
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)" }}>
                Abre la cámara · JPG, PNG aceptados
              </p>
            </div>
          </button>
        )}

        {state === "processing" && (
          <div
            className="w-full flex flex-col items-center justify-center gap-5 rounded-2xl py-10"
            style={{ background: "rgba(11,61,107,0.03)", border: "1px solid rgba(11,61,107,0.08)" }}
          >
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-xl" style={{ border: "2px solid rgba(0,165,181,0.2)" }} />
              <div
                className="absolute inset-0 rounded-xl animate-spin"
                style={{ border: "2px solid transparent", borderTopColor: "#00A5B5", borderRightColor: "#00A5B5" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0B3D6B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                </svg>
              </div>
            </div>
            <div className="w-48">
              <p className="text-xs mb-1.5 text-center" style={{ color: "#64748b", fontFamily: "var(--font-dm-sans)" }}>
                Analizando receta con IA...
              </p>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,165,181,0.15)" }}>
                <div className="h-full rounded-full animate-scan" style={{ background: "#00A5B5" }} />
              </div>
            </div>
            <p className="text-xs text-center" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)", maxWidth: 200 }}>
              Claude Vision · Catálogo Farmatodo
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="animate-fade-up">
            <div
              className="w-full flex flex-col items-center gap-3 rounded-2xl py-8 px-4 text-center"
              style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)" }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm font-medium" style={{ color: "#dc2626", fontFamily: "var(--font-plus-jakarta)" }}>
                {errorMsg}
              </p>
              <button
                onClick={handleUploadTap}
                className="text-sm font-semibold px-4 py-2 rounded-lg"
                style={{ background: "#0B3D6B", color: "white", fontFamily: "var(--font-dm-sans)" }}
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        )}

        {state === "results" && (
          <div className="animate-fade-up">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#16a34a" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-sm font-semibold" style={{ color: "#1a2332", fontFamily: "var(--font-plus-jakarta)" }}>
                  {results.length} medicamento{results.length !== 1 ? "s" : ""} detectado{results.length !== 1 ? "s" : ""}
                </span>
              </div>
              <button onClick={handleUploadTap} className="text-xs" style={{ color: "#00A5B5", fontFamily: "var(--font-dm-sans)" }}>
                Nueva receta
              </button>
            </div>

            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(11,61,107,0.08)", boxShadow: "0 1px 4px rgba(11,61,107,0.06)" }}
            >
              {results.map((med, i) => (
                <div
                  key={i}
                  className={`bg-white p-3 ${i < results.length - 1 ? "border-b" : ""}`}
                  style={{ borderColor: "rgba(11,61,107,0.06)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs mb-0.5" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)" }}>
                        {med.written}
                      </p>
                      <p className="text-xs font-semibold leading-tight" style={{ color: "#1a2332", fontFamily: "var(--font-dm-sans)" }}>
                        {med.matched ?? "Sin coincidencia en catálogo"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {med.confidence > 0 && (
                        <span className="chip-confidence">{med.confidence}%</span>
                      )}
                      {med.matched ? (
                        med.available
                          ? <span className="chip-available">Disponible</span>
                          : <span className="chip-unavailable">Agotado</span>
                      ) : (
                        <span className="chip-unavailable">No encontrado</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {availableResults.length > 0 && (
              <button
                onClick={handleAddCart}
                disabled={cartAdded}
                className="w-full mt-3 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] duration-150"
                style={{
                  background: cartAdded ? "#16a34a" : "#0B3D6B",
                  color: "white",
                  fontFamily: "var(--font-plus-jakarta)",
                }}
              >
                {cartAdded
                  ? `✓ ${availableResults.length} productos agregados`
                  : `Agregar disponibles al carrito (${availableResults.length})`}
              </button>
            )}

            <div
              className="flex items-start gap-2 mt-3 p-3 rounded-xl"
              style={{ background: "rgba(26,122,181,0.06)", border: "1px solid rgba(26,122,181,0.12)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A7AB5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs leading-relaxed" style={{ color: "#1A7AB5", fontFamily: "var(--font-dm-sans)" }}>
                Validación farmacéutica por personal de Farmatodo antes de despacho
              </p>
            </div>
          </div>
        )}
      </div>

      {/* How it works — shown only in idle state */}
      {state === "idle" && (
        <div className="px-4 mt-5">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)", letterSpacing: "0.1em" }}>
            Cómo funciona
          </p>
          <div className="flex flex-col gap-2">
            {[
              { step: "1", text: "Tomas foto de tu receta médica" },
              { step: "2", text: "Claude Vision extrae los medicamentos con IA" },
              { step: "3", text: "Matching semántico contra el catálogo Farmatodo real" },
              { step: "4", text: "Farmacéutico valida y despacha" },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                  style={{ background: "#0B3D6B", color: "white", fontFamily: "var(--font-plus-jakarta)" }}
                >
                  {item.step}
                </div>
                <p className="text-sm" style={{ color: "#475569", fontFamily: "var(--font-dm-sans)" }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
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
          {availableResults.length} productos agregados al carrito
        </div>
      )}
    </div>
  );
}
