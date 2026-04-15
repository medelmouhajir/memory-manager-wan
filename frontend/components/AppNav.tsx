"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/logs", label: "Logs" },
  { href: "/memory", label: "Memory" },
  { href: "/tasks", label: "Tasks" },
  { href: "/decisions", label: "Decisions" },
  { href: "/snapshot", label: "Snapshot" },
  { href: "/search", label: "Search" },
  { href: "/contradictions", label: "Contradictions" }
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-4 flex flex-wrap gap-2">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            className={`rounded-md px-3 py-1 text-sm ${active ? "bg-emerald-500 text-black" : "bg-slate-800 text-slate-200"}`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
