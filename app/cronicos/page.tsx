"use client";

import { useState, useEffect } from "react";
import type { ChronicPatient } from "@/lib/supabase";

const adherenceColor = (pct: number) => {
  if (pct >= 90) return "#16a34a";
  if (pct >= 70) return "#d97706";
  return "#dc2626";
};

const urgencyLabel: Record<string, { bg: string; color: string; text: string }> = {
  high: { bg: "#fef2f2", color: "#dc2626", text: "Urgente" },
  medium: { bg: "#fffbeb", color: "#d97706", text: "Próximo" },
  low: { bg: "#f0fdf4", color: "#16a34a", text: "Al día" },
};

export default function CronicosPage() {
  const [patients, setPatients] = useState<ChronicPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [generatingMsg, setGeneratingMsg] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/cronicos")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setPatients(d.patients);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleCard = async (i: number, patient: ChronicPatient) => {
    if (active === i) { setActive(null); return; }
    setActive(i);

    // Generate WhatsApp message if not already generated
    if (!messages[patient.id]) {
      setGeneratingMsg(patient.id);
      try {
        const res = await fetch("/api/cronicos/mensaje", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: patient.name,
            medication: patient.medication,
            nextRefill: patient.next_refill_label,
            store: patient.store,
            adherence: patient.adherence,
          }),
        });
        const data = await res.json();
        if (data.mensaje) {
          setMessages((prev) => ({ ...prev, [patient.id]: data.mensaje }));
        }
      } catch {
        setMessages((prev) => ({
          ...prev,
          [patient.id]: `Hola ${patient.name}! Tu ${patient.medication} vence en ${patient.next_refill_label}. Pásate por ${patient.store} 💊`,
        }));
      } finally {
        setGeneratingMsg(null);
      }
    }
  };

  const buildWaLink = (patient: ChronicPatient) => {
    const msg = messages[patient.id] ?? "";
    const phone = patient.phone?.replace(/\D/g, "") ?? "";
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-5 pt-10 pb-5" style={{ background: "#0B3D6B" }}>
        <p className="text-white/50 text-[10px] uppercase tracking-widest mb-1" style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}>
          Módulo 03
        </p>
        <h2 className="text-white text-2xl font-bold leading-tight" style={{ fontFamily: "var(--font-plus-jakarta)" }}>
          Seguimiento Crónico
        </h2>

        <div className="mt-4 rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold" style={{ color: "#ef4444", fontFamily: "var(--font-plus-jakarta)" }}>40%</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
              <span className="text-2xl font-bold" style={{ color: "#4ade80", fontFamily: "var(--font-plus-jakarta)" }}>12%</span>
            </div>
            <p className="text-white/60 text-xs mt-0.5" style={{ fontFamily: "var(--font-dm-sans)" }}>
              Reducción abandono de tratamiento con seguimiento activo
            </p>
          </div>
        </div>
      </div>

      {/* Patient list */}
      <div className="px-4 pt-4 flex flex-col gap-3">
        <p className="text-xs uppercase tracking-widest mb-1 px-1" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)", letterSpacing: "0.1em" }}>
          {loading ? "Cargando pacientes..." : error ? "Error" : `Pacientes activos · ${patients.length} en seguimiento`}
        </p>

        {loading && (
          <div className="flex justify-center py-12">
            <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00A5B5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          </div>
        )}

        {error && !loading && (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: "#dc2626", fontFamily: "var(--font-dm-sans)" }}>{error}</p>
          </div>
        )}

        {!loading && !error && patients.map((patient, i) => {
          const urgency = urgencyLabel[patient.urgency] ?? urgencyLabel.medium;
          const isActive = active === i;
          const msg = messages[patient.id];
          const isGenerating = generatingMsg === patient.id;

          return (
            <button
              key={patient.id}
              onClick={() => toggleCard(i, patient)}
              className="w-full text-left bg-white rounded-2xl p-4 transition-all active:scale-[0.98] duration-150"
              style={{
                borderLeft: `4px solid ${adherenceColor(patient.adherence)}`,
                boxShadow: isActive ? "0 4px 16px rgba(11,61,107,0.14)" : "0 1px 4px rgba(11,61,107,0.07)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-sm" style={{ color: "#1a2332", fontFamily: "var(--font-plus-jakarta)" }}>
                      {patient.name}
                    </p>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: urgency.bg, color: urgency.color, fontFamily: "var(--font-dm-sans)" }}
                    >
                      {urgency.text}
                    </span>
                  </div>
                  <p className="text-xs mb-2" style={{ color: "#64748b", fontFamily: "var(--font-dm-sans)" }}>
                    {patient.medication} · Recarga: <strong>{patient.next_refill_label}</strong>
                  </p>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px]" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)" }}>Adherencia</span>
                      <span className="text-[10px] font-bold" style={{ color: adherenceColor(patient.adherence), fontFamily: "var(--font-dm-sans)" }}>
                        {patient.adherence}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${patient.adherence}%`, background: adherenceColor(patient.adherence) }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 mt-1 transition-transform duration-200" style={{ transform: isActive ? "rotate(180deg)" : "rotate(0deg)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* WhatsApp preview */}
              {isActive && (
                <div className="mt-4 animate-fade-up">
                  <div className="h-px mb-3" style={{ background: "rgba(11,61,107,0.07)" }} />
                  <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)", letterSpacing: "0.1em" }}>
                    Mensaje WhatsApp que se enviaría:
                  </p>

                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
                    {/* WhatsApp header */}
                    <div className="px-3 py-2 flex items-center gap-2" style={{ background: "#075E54" }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#128C7E" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.38 1.26 4.78L2.05 22l5.44-1.43c1.38.75 2.95 1.17 4.55 1.17 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white text-xs font-bold" style={{ fontFamily: "var(--font-dm-sans)" }}>
                          {patient.store}
                        </p>
                        <p className="text-white/60 text-[10px]" style={{ fontFamily: "var(--font-dm-sans)" }}>en línea</p>
                      </div>
                    </div>

                    {/* Chat bubble */}
                    <div className="px-3 py-3 flex justify-end" style={{ background: "#ECE5DD" }}>
                      {isGenerating ? (
                        <div className="flex gap-1.5 items-center px-4 py-3 rounded-xl" style={{ background: "#DCF8C6" }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      ) : (
                        <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-tr-sm" style={{ background: "#DCF8C6" }}>
                          <p className="text-sm leading-relaxed" style={{ color: "#111b21", fontFamily: "var(--font-dm-sans)" }}>
                            {msg ?? "Generando mensaje..."}
                          </p>
                          <p className="text-right text-[10px] mt-1" style={{ color: "#667781", fontFamily: "var(--font-dm-sans)" }}>
                            {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, "0")} ✓✓
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {msg && (
                    <a
                      href={buildWaLink(patient)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                      style={{ background: "#25D366", color: "white", fontFamily: "var(--font-dm-sans)", display: "flex" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.38 1.26 4.78L2.05 22l5.44-1.43c1.38.75 2.95 1.17 4.55 1.17 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2z" />
                      </svg>
                      Enviar por WhatsApp
                    </a>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom info */}
      {!loading && !error && (
        <div className="mx-4 mt-4 mb-2">
          <div className="rounded-xl p-4" style={{ background: "rgba(11,61,107,0.04)", border: "1px solid rgba(11,61,107,0.08)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#0B3D6B", fontFamily: "var(--font-plus-jakarta)" }}>
              Automatización completa
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "#64748b", fontFamily: "var(--font-dm-sans)" }}>
              El sistema detecta cuándo vence cada tratamiento y envía el recordatorio automáticamente. Sin intervención manual del equipo Farmatodo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
