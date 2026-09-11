"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";

const START_PATH = "/dashboard/start";

export default function DashboardChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname === START_PATH) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4">
        <button
          type="button"
          className="p-2 -ml-2 rounded-lg text-gray-700 hover:bg-gray-100"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <Link href="/dashboard" className="flex items-center" aria-label="QrStars">
          <img src="/logo.svg" alt="QrStars" width={120} height={30} className="select-none" draggable={false} />
        </Link>
      </header>

      {open && (
        <button
          type="button"
          aria-label="Закрыть меню"
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed lg:static z-50 inset-y-0 left-0 w-64 shrink-0 transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Sidebar onNavigate={() => setOpen(false)} />
      </div>

      <div className="flex-1 min-w-0 pt-14 lg:pt-0">{children}</div>
    </div>
  );
}
