"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/",
    label: "Inicio",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#0B3D6B" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/recetas",
    label: "Recetas",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#0B3D6B" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
        <line x1="9" y1="9" x2="10" y2="9" />
      </svg>
    ),
  },
  {
    href: "/voz",
    label: "Voz",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#0B3D6B" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
  {
    href: "/cronicos",
    label: "Crónicos",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#0B3D6B" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        <polyline points="8 12 10 14 16 10" />
      </svg>
    ),
  },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50"
      style={{ boxShadow: "0 -1px 12px rgba(11,61,107,0.08)" }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2 pb-safe">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all duration-150 active:scale-95"
            >
              {tab.icon(isActive)}
              <span
                className="text-[10px] font-medium tracking-wide transition-colors duration-150"
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  color: isActive ? "#0B3D6B" : "#94a3b8",
                }}
              >
                {tab.label}
              </span>
              {isActive && (
                <span
                  className="absolute bottom-0 w-8 h-0.5 rounded-full"
                  style={{ background: "#00A5B5" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
