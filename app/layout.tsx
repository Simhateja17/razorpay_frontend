import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppStateProvider } from "@/lib/store/AppState";
import HeaderNav from "@/components/shared/HeaderNav";
import BackendErrorBanner from "@/components/shared/BackendErrorBanner";

const instrumentSans = Instrument_Sans({ //test
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Cartisan — Agentic Commerce",
  description: "Razorpay AI Buildathon Track 1 — bounded, explainable, gated agentic commerce.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${instrumentSans.variable} ${jetbrainsMono.variable} antialiased h-screen flex flex-col overflow-hidden`}>
        <AppStateProvider>
          <HeaderNav />
          <BackendErrorBanner />
          <div className="flex-1 min-h-0">{children}</div>
        </AppStateProvider>
      </body>
    </html>
  );
}
