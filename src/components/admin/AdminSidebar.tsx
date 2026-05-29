"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Star,
  Store,
  LogOut,
  Shield,
  Package,
  Wallet,
  ShoppingCart,
  Headphones,
} from "lucide-react";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard, tourId: "nav-overview" },
  { href: "/admin/users", label: "Пользователи", icon: Users, tourId: "nav-users" },
  { href: "/admin/payments", label: "Подписки", icon: CreditCard, tourId: "nav-payments" },
  { href: "/admin/reviews", label: "Отзывы", icon: Star, tourId: "nav-reviews" },
  { href: "/admin/orders", label: "Заказы", icon: ShoppingCart, tourId: "nav-orders" },
  { href: "/admin/establishments", label: "Заведения", icon: Store, tourId: "nav-establishments" },
  { href: "/admin/batches", label: "Наборы табличек", icon: Package, tourId: "nav-batches" },
  { href: "/admin/partner-withdrawals", label: "Выводы партнёров", icon: Wallet, tourId: "nav-partner-withdrawals" },
  { href: "/admin/support", label: "Support", icon: Headphones, tourId: "nav-support" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <Link href="/admin" className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-amber-400" />
          <span className="font-bold text-lg text-white">QrStars.ru</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour-id={item.tourId}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-800 text-amber-400"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800 space-y-1">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white w-full transition-colors"
        >
          <Store className="w-5 h-5" />
          В пользовательскую панель
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Выйти
        </button>
      </div>
    </aside>
  );
}
