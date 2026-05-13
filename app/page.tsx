import Link from "next/link";

const modules = [
  {
    number: "01",
    href: "/recetas",
    title: "Lector de Recetas",
    description:
      "Foto de receta → catálogo Farmatodo en segundos. Matching semántico con validación farmacéutica.",
    accent: "#00A5B5",
    tag: "Vision IA",
  },
  {
    number: "02",
    href: "/voz",
    title: "Carrito por Voz",
    description:
      "El cliente habla, la IA busca en el catálogo y arma el pedido. Cero fricción.",
    accent: "#1A7AB5",
    tag: "NLP + Catálogo",
  },
  {
    number: "03",
    href: "/cronicos",
    title: "Seguimiento Crónico",
    description:
      "Recordatorios personalizados vía WhatsApp para pacientes con tratamientos continuos.",
    accent: "#0B3D6B",
    tag: "WhatsApp API",
  },
];

const stats = [
  { value: "1,675", label: "productos conectados" },
  { value: "204", label: "tiendas" },
  { value: "3", label: "módulos IA" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <header
        className="px-5 pt-12 pb-8"
        style={{ background: "linear-gradient(160deg, #0B3D6B 0%, #0e4d85 100%)" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "#00A5B5" }}
          >
            <span
              style={{
                fontFamily: "var(--font-plus-jakarta)",
                fontWeight: 800,
                fontSize: 14,
                color: "white",
                lineHeight: 1,
              }}
            >
              N
            </span>
          </div>
          <p
            className="text-white/60 text-xs tracking-widest uppercase"
            style={{ fontFamily: "var(--font-dm-sans)", letterSpacing: "0.12em" }}
          >
            NexusIA × Farmatodo
          </p>
        </div>

        <h1
          className="text-white mt-4 leading-tight"
          style={{
            fontFamily: "var(--font-plus-jakarta)",
            fontWeight: 800,
            fontSize: "1.75rem",
            lineHeight: 1.2,
          }}
        >
          Inteligencia artificial
          <br />
          para tu farmacia
        </h1>
        <p
          className="text-white/60 text-sm mt-2 leading-relaxed"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          3 módulos listos para integrar en la app de Farmatodo como microservicios.
        </p>
      </header>

      {/* Stat bar */}
      <div
        className="grid grid-cols-3 divide-x"
        style={{ background: "#E8F3FA", borderColor: "#cce4f4" }}
      >
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center py-3 px-2 gap-0.5">
            <span
              className="font-display font-bold text-lg leading-none"
              style={{ color: "#0B3D6B", fontFamily: "var(--font-plus-jakarta)" }}
            >
              {s.value}
            </span>
            <span
              className="text-[10px] text-center leading-tight"
              style={{ color: "#4a7fa5", fontFamily: "var(--font-dm-sans)" }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Module cards */}
      <div className="flex flex-col gap-3 p-4 pt-5">
        <p
          className="text-xs uppercase tracking-widest mb-1 px-1"
          style={{ color: "#94a3b8", fontFamily: "var(--font-dm-sans)", letterSpacing: "0.1em" }}
        >
          Módulos disponibles
        </p>
        {modules.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="block bg-white rounded-2xl overflow-hidden relative active:scale-[0.98] transition-transform duration-100"
            style={{
              borderLeft: `4px solid ${mod.accent}`,
              boxShadow: "0 1px 4px rgba(11,61,107,0.07), 0 0 0 1px rgba(11,61,107,0.04)",
            }}
          >
            {/* Ghost number */}
            <span
              className="absolute right-3 -top-2 select-none pointer-events-none"
              style={{
                fontFamily: "var(--font-plus-jakarta)",
                fontWeight: 800,
                fontSize: "5.5rem",
                color: mod.accent,
                opacity: 0.07,
                lineHeight: 1,
              }}
            >
              {mod.number}
            </span>

            <div className="p-4 pr-14">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: `${mod.accent}15`,
                    color: mod.accent,
                    fontFamily: "var(--font-dm-sans)",
                    border: `1px solid ${mod.accent}30`,
                  }}
                >
                  {mod.tag}
                </span>
              </div>
              <h3
                className="text-base font-bold leading-tight mb-1"
                style={{ color: "#1a2332", fontFamily: "var(--font-plus-jakarta)" }}
              >
                {mod.title}
              </h3>
              <p
                className="text-sm leading-snug"
                style={{ color: "#64748b", fontFamily: "var(--font-dm-sans)" }}
              >
                {mod.description}
              </p>
              <div className="flex items-center gap-1 mt-3">
                <span
                  className="text-xs font-semibold"
                  style={{ color: mod.accent, fontFamily: "var(--font-dm-sans)" }}
                >
                  Ver demo
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={mod.accent}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* API badge */}
      <div className="mx-4 mb-2 mt-1">
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{
            background: "rgba(11, 61, 107, 0.04)",
            border: "1px solid rgba(11, 61, 107, 0.1)",
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: "#0B3D6B" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <div>
            <p
              className="text-xs font-semibold mb-0.5"
              style={{ color: "#0B3D6B", fontFamily: "var(--font-plus-jakarta)" }}
            >
              API-first · Sin reemplazar tu app
            </p>
            <p
              className="text-xs leading-relaxed"
              style={{ color: "#64748b", fontFamily: "var(--font-dm-sans)" }}
            >
              Cada módulo se integra como endpoint en la infraestructura existente de Farmatodo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
