import "./globals.css";
import type { ReactNode } from "react";
import { AppNav } from "../components/AppNav";
import { SystemStatusBanner } from "../components/SystemStatusBanner";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-6xl px-6 py-6">
          <header className="mb-4">
            <h1 className="text-2xl font-bold text-emerald-300">Session Vault Dashboard</h1>
            <p className="text-slate-300">Persistent memory operations and audit controls.</p>
          </header>
          <SystemStatusBanner />
          <AppNav />
          {children}
        </main>
      </body>
    </html>
  );
}
