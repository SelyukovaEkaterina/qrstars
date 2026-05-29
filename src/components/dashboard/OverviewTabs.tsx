"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", label: "Сводка" },
  { href: "/dashboard/analytics", label: "Аналитика" },
];

export default function OverviewTabs() {
  const pathname = usePathname();

  return (
    <div className="inline-flex gap-1 p-1 bg-gray-100 rounded-lg">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
