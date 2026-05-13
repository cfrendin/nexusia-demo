import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import TabBar from "@/components/TabBar";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NexusIA × Farmatodo",
  description: "Inteligencia artificial para tu farmacia — Demo confidencial",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NexusIA Demo",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B3D6B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${plusJakarta.variable} ${dmSans.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="bg-surface min-h-screen">
        <div className="max-w-md mx-auto min-h-screen flex flex-col relative bg-surface">
          <main className="flex-1 pb-20 overflow-y-auto">
            {children}
            <footer className="text-center py-5 px-4">
              <p className="text-[11px] text-gray-400 font-body tracking-wide">
                Demo confidencial · NexusIA para Farmatodo · 2026
              </p>
            </footer>
          </main>
          <TabBar />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`,
          }}
        />
      </body>
    </html>
  );
}
