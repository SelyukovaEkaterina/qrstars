"use client";

import React, { useMemo, useRef, useState, useCallback } from "react";
import { type MenuData, type MenuItemData } from "@/components/dashboard/MenuEditor";
import { Minus, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import type { BrandTheme } from "@/lib/brand-theme";
import {
  activePillStyle,
  headingColor,
  headerBarStyle,
  mutedColor,
  panelStyle,
  priceTagStyle,
  primaryButtonStyle,
  scanRootStyle,
  sectionAccentStyle,
  submutedColor,
  coverOverlayStyle,
} from "@/lib/brand-theme-ui";
import { useBrandThemeScan, type BrandThemeScanProps } from "@/components/scan/brand-theme-props";
import ConsentCheckbox from "@/components/scan/ConsentCheckbox";
import type { PdConsent } from "@/components/scan/ScanFlow";

interface MenuViewProps extends BrandThemeScanProps {
  menu: MenuData;
  establishmentName?: string;
  embedded?: boolean;
  isBg?: boolean;
  establishmentId?: string;
  qrCodeId?: string;
  qrLabel?: string;
  isDemo?: boolean;
  pdConsent?: PdConsent;
  /** false на PRO/«Сеть» при включённом white-label */
  watermarkEnabled?: boolean;
}

interface CartItem {
  item: MenuItemData;
  qty: number;
}

function cartItemKey(item: MenuItemData): string {
  return item.iikoProductId ?? item.id ?? item.name;
}

const UNCATEGORIZED = "Прочее";

function itemCategory(item: MenuItemData): string {
  return item.category?.trim() || UNCATEGORIZED;
}

function groupByCategory(items: MenuItemData[]): { category: string; items: MenuItemData[] }[] {
  const map = new Map<string, MenuItemData[]>();
  for (const item of items) {
    const cat = itemCategory(item);
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  return Array.from(map.entries()).map(([category, categoryItems]) => ({
    category,
    items: categoryItems,
  }));
}

function parsePrice(price: string | null): number | null {
  if (!price) return null;
  const cleaned = price.replace(/[^\d.,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** Заголовок iiko из API — гостю не показываем, если есть название заведения. */
function isIikoTechnicalMenuTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) return true;
  const t = title.trim().toLowerCase();
  return (
    t.includes("сайт") ||
    t.includes("приложен") ||
    t === "site" ||
    t === "app"
  );
}

function guestMenuHeading(
  establishmentName: string | undefined,
  menu: MenuData
): string | null {
  const est = establishmentName?.trim();
  if (est) return est;
  if (menu.source === "IIKO" && isIikoTechnicalMenuTitle(menu.title)) {
    return "Меню";
  }
  return menu.title?.trim() || "Меню";
}

function fieldStyle(isBg?: boolean): React.CSSProperties {
  return isBg
    ? { backgroundColor: "var(--brand-cover-module-bg)", borderColor: "var(--brand-cover-module-border)", color: "#fff" }
    : { backgroundColor: "var(--brand-surface)", borderColor: "var(--brand-border)", color: "var(--brand-heading)" };
}

function FormField({ label, isBg, children }: { label: string; isBg?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: headingColor(isBg) }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function CartQtyControls({
  qtyInCart,
  onAdd,
  onRemove,
  isBg,
  size = "md",
}: {
  qtyInCart: number;
  onAdd: () => void;
  onRemove: () => void;
  isBg?: boolean;
  size?: "sm" | "md";
}) {
  const btn = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const icon = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  if (qtyInCart === 0) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className={`${btn} rounded-full flex items-center justify-center shrink-0 transition-colors`}
        style={primaryButtonStyle()}
        aria-label="Добавить в корзину"
      >
        <Plus className={icon} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onRemove}
        className={`${btn} rounded-full flex items-center justify-center transition-colors`}
        style={
          isBg
            ? { backgroundColor: "var(--brand-cover-module-bg)", color: "#fff" }
            : { backgroundColor: "var(--brand-row-bg)", color: "var(--brand-heading)" }
        }
        aria-label="Уменьшить"
      >
        <Minus className={icon} />
      </button>
      <span
        className="font-semibold text-sm min-w-[1.1rem] text-center tabular-nums"
        style={{ color: headingColor(isBg) }}
      >
        {qtyInCart}
      </span>
      <button
        type="button"
        onClick={onAdd}
        className={`${btn} rounded-full flex items-center justify-center transition-colors`}
        style={primaryButtonStyle()}
        aria-label="Увеличить"
      >
        <Plus className={icon} />
      </button>
    </div>
  );
}

function MenuItemCard({
  item,
  onOpen,
  compact,
  isBg,
  cartEnabled,
  qtyInCart,
  onAddToCart,
  onRemoveFromCart,
}: {
  item: MenuItemData;
  onOpen: () => void;
  compact?: boolean;
  theme: BrandTheme;
  dark: boolean;
  isBg?: boolean;
  cartEnabled?: boolean;
  qtyInCart: number;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
}) {
  const hasImage = !!item.imageUrl;
  const cardSurface = isBg
    ? { backgroundColor: "var(--brand-cover-module-bg)", borderColor: "var(--brand-cover-module-border)" }
    : { backgroundColor: "var(--brand-module-bg)", borderColor: "var(--brand-module-border)" };
  const imgBg = isBg
    ? { backgroundColor: "var(--brand-cover-module-bg)" }
    : { backgroundColor: "var(--brand-row-bg)" };

  const pad = hasImage
    ? compact
      ? "p-2.5 gap-2.5"
      : "p-3 gap-3"
    : compact
      ? "p-2 gap-2"
      : "p-2.5 gap-2.5";

  return (
    <div
      className={`w-full text-left shadow-sm flex transition-transform active:scale-[0.98] border backdrop-blur-md hover:shadow-md rounded-xl ${pad}`}
      style={cardSurface}
    >
      {hasImage && (
        <button
          type="button"
          onClick={onOpen}
          className={`rounded-lg overflow-hidden shrink-0 ${
            compact ? "w-14 h-14" : "w-20 h-20 sm:w-24 sm:h-24"
          }`}
          style={imgBg}
          aria-label={`Открыть ${item.name}`}
        >
          <img
            src={item.imageUrl!}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </button>
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
            <h3
              className={`font-semibold leading-snug truncate ${compact ? "text-sm" : "text-[15px]"}`}
              style={{ color: headingColor(isBg) }}
            >
              {item.name}
            </h3>
          </button>
          {item.price && (
            <span
              className="font-semibold whitespace-nowrap text-sm shrink-0 tabular-nums"
              style={priceTagStyle(isBg)}
            >
              {item.price}
            </span>
          )}
          {cartEnabled && (
            <CartQtyControls
              qtyInCart={qtyInCart}
              onAdd={onAddToCart}
              onRemove={onRemoveFromCart}
              isBg={isBg}
              size="sm"
            />
          )}
        </div>
        {(item.weight || item.description) && (
          <button type="button" onClick={onOpen} className="text-left flex flex-wrap items-center gap-x-2 gap-y-0">
            {item.weight && (
              <span className="text-[11px]" style={{ color: mutedColor(isBg) }}>
                {item.weight}
              </span>
            )}
            {item.description && (
              <span className="text-[11px]" style={{ color: submutedColor(isBg) }}>
                Подробнее
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

type OrderStep = "cart" | "form" | "success";

export default function MenuView({
  menu,
  establishmentName,
  embedded,
  brandColor,
  pageAppearance,
  isBg,
  establishmentId,
  qrCodeId,
  qrLabel,
  isDemo = false,
  pdConsent,
  watermarkEnabled = true,
}: MenuViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItemData | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Cart state
  const cartEnabled = !embedded && !!menu.cartEnabled;
  const isIikoMenu = menu.source === "IIKO";
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderStep, setOrderStep] = useState<OrderStep>("cart");
  const [guestName, setGuestName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [comment, setComment] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const phoneEmailAllowed = isDemo || !pdConsent || pdConsent.ready;
  const needsConsent = !isDemo && !!pdConsent?.ready && (menu.askPhone || menu.askEmail);

  const { theme, dark } = useBrandThemeScan({ brandColor, pageAppearance });

  const visibleItems = useMemo(
    () => menu.items.filter((item) => !item.hidden),
    [menu.items]
  );

  const filteredItems = useMemo(
    () =>
      visibleItems.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [visibleItems, searchQuery]
  );

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const item of visibleItems) {
      const cat = itemCategory(item);
      if (!seen.has(cat)) {
        seen.add(cat);
        order.push(cat);
      }
    }
    return order;
  }, [visibleItems]);

  const grouped = useMemo(() => groupByCategory(filteredItems), [filteredItems]);

  const scrollToCategory = (category: string) => {
    setActiveCategory(category);
    sectionRefs.current[category]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const qtyInCart = useCallback((item: MenuItemData) => {
    return cart.find((c) => cartItemKey(c.item) === cartItemKey(item))?.qty ?? 0;
  }, [cart]);

  const addToCart = useCallback((item: MenuItemData) => {
    setCart((prev) => {
      const key = cartItemKey(item);
      const idx = prev.findIndex((c) => cartItemKey(c.item) === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { item, qty: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((item: MenuItemData) => {
    setCart((prev) => {
      const key = cartItemKey(item);
      const idx = prev.findIndex((c) => cartItemKey(c.item) === key);
      if (idx < 0) return prev;
      const next = [...prev];
      if (next[idx].qty <= 1) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], qty: next[idx].qty - 1 };
      }
      return next;
    });
  }, []);

  const removeCartItem = useCallback((item: MenuItemData) => {
    const key = cartItemKey(item);
    setCart((prev) => prev.filter((c) => cartItemKey(c.item) !== key));
  }, []);

  const totalCount = cart.reduce((s, c) => s + c.qty, 0);

  const { totalValue, hasTotal } = useMemo(() => {
    let val = 0;
    let has = false;
    for (const c of cart) {
      const p = parsePrice(c.item.price);
      if (p !== null) {
        val += p * c.qty;
        has = true;
      }
    }
    return { totalValue: val, hasTotal: has };
  }, [cart]);

  const handleOpenCart = () => {
    setOrderStep("cart");
    setSubmitError(null);
    setCartOpen(true);
  };

  const handleSubmitOrder = async () => {
    if (!guestName.trim()) {
      setSubmitError("Укажите ваше имя");
      return;
    }
    if (isIikoMenu && !guestPhone.trim()) {
      setSubmitError("Укажите телефон для заказа");
      return;
    }
    if (isIikoMenu && fulfillment === "delivery" && !guestAddress.trim()) {
      setSubmitError("Укажите адрес доставки");
      return;
    }
    if (isDemo) {
      setOrderStep("success");
      return;
    }
    if (!establishmentId) {
      setSubmitError("Не удалось определить заведение");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/menus/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId,
          qrCodeId,
          qrLabel,
          guestName: guestName.trim(),
          tableNumber: tableNumber.trim() || undefined,
          guestPhone:
            menu.askPhone || isIikoMenu ? guestPhone.trim() || undefined : undefined,
          guestEmail: menu.askEmail ? guestEmail.trim() || undefined : undefined,
          guestAddress:
            menu.askAddress || (isIikoMenu && fulfillment === "delivery")
              ? guestAddress.trim() || undefined
              : undefined,
          comment: comment.trim() || undefined,
          items: cart.map((c) => ({
            name: c.item.name,
            price: c.item.price,
            qty: c.qty,
            iikoProductId: c.item.iikoProductId,
            iikoSizeId: c.item.iikoSizeId,
          })),
          ...(isIikoMenu ? { fulfillment } : {}),
          ...(consentChecked ? { pdConsentGiven: true } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Ошибка отправки заказа");
        return;
      }
      setOrderStep("success");
      setCart([]);
    } catch {
      setSubmitError("Не удалось отправить заказ. Проверьте соединение.");
    } finally {
      setSubmitting(false);
    }
  };

  const rootClass = embedded
    ? "min-h-0 h-full pb-6 relative z-10"
    : isBg
      ? "min-h-screen pb-10 relative z-10"
      : "min-h-screen pb-10";
  const containerClass = embedded ? "px-3 py-2 space-y-2" : "max-w-xl mx-auto px-4 py-2 space-y-2";
  const contentClass = embedded ? "px-3 py-3 space-y-4" : "max-w-xl mx-auto px-4 py-3 space-y-5";
  const scrollMt = embedded ? "scroll-mt-28" : "scroll-mt-32";
  const guestHeading = guestMenuHeading(establishmentName, menu);
  const showMenuDescription =
    !!menu.description?.trim() && menu.source !== "IIKO";

  return (
    <div className={rootClass} style={scanRootStyle(theme, { isBg, embedded })}>
      <div
        className="sticky top-0 z-20 backdrop-blur-md shadow-sm border-b"
        style={headerBarStyle(isBg, dark)}
      >
        <div className={containerClass}>
          {guestHeading && (
            <h1
              className={`font-semibold truncate ${embedded ? "text-base" : "text-lg"}`}
              style={{ color: headingColor(isBg) }}
            >
              {guestHeading}
            </h1>
          )}
          {showMenuDescription && (
            <p className="text-xs line-clamp-2" style={{ color: mutedColor(isBg) }}>
              {menu.description}
            </p>
          )}

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className={`h-5 w-5 ${isBg ? "text-white/50" : dark ? "text-slate-500" : "text-gray-400"}`} />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-1.5 border rounded-lg leading-5 text-sm transition-colors focus:outline-none focus:ring-2 backdrop-blur-sm"
              style={
                isBg
                  ? {
                      backgroundColor: "var(--brand-cover-module-bg)",
                      borderColor: "var(--brand-cover-module-border)",
                      color: "#fff",
                    }
                  : {
                      backgroundColor: "var(--brand-surface)",
                      borderColor: "var(--brand-border)",
                      color: "var(--brand-heading)",
                    }
              }
              placeholder="Поиск по меню..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveCategory(null);
              }}
            />
          </div>

          {!searchQuery && categories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => scrollToCategory(cat)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors backdrop-blur-sm border"
                  style={
                    activeCategory === cat
                      ? isBg
                        ? { backgroundColor: "var(--brand-600)", color: "#fff", borderColor: "var(--brand-600)" }
                        : activePillStyle()
                      : isBg
                        ? {
                            backgroundColor: "var(--brand-cover-module-bg)",
                            color: "#fff",
                            borderColor: "var(--brand-cover-module-border)",
                          }
                        : {
                            backgroundColor: "var(--brand-row-bg)",
                            color: "var(--brand-muted)",
                            borderColor: "var(--brand-border)",
                          }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={contentClass}>
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🔍</div>
            <p style={{ color: mutedColor(isBg) }}>
              {menu.items.length === 0
                ? "Добавьте позиции в меню"
                : visibleItems.length === 0
                  ? "Все позиции сейчас скрыты"
                  : "По вашему запросу ничего не найдено"}
            </p>
          </div>
        ) : (
          grouped.map(({ category, items }) => (
            <section
              key={category}
              ref={(el) => {
                sectionRefs.current[category] = el;
              }}
              className={scrollMt}
            >
              <h2
                className="text-base font-bold mb-2 flex items-center gap-2"
                style={{ color: headingColor(isBg) }}
              >
                <span
                  className="w-1 h-5 rounded-full"
                  style={isBg ? { backgroundColor: "var(--brand-500)" } : sectionAccentStyle()}
                />
                {category}
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {items.map((item) => (
                  <MenuItemCard
                    key={item.id || item.name}
                    item={item}
                    onOpen={() => setSelectedItem(item)}
                    compact={embedded}
                    theme={theme}
                    dark={dark}
                    isBg={isBg}
                    cartEnabled={cartEnabled}
                    qtyInCart={qtyInCart(item)}
                    onAddToCart={() => addToCart(item)}
                    onRemoveFromCart={() => removeFromCart(item)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {!embedded && watermarkEnabled && (
        <div className={`text-center mt-8 ${cartEnabled && totalCount > 0 ? "pb-24" : "pb-4"}`}>
          <p className="text-xs" style={{ color: submutedColor(isBg) }}>
            Сделано в QrStars.ru
          </p>
        </div>
      )}

      {/* Плавающая панель корзины */}
      {cartEnabled && totalCount > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-30 flex justify-center px-4">
          <button
            type="button"
            onClick={handleOpenCart}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg transition-transform active:scale-[0.97] max-w-sm w-full"
            style={primaryButtonStyle()}
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 bg-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center" style={{ color: "var(--brand-600)" }}>
                {totalCount}
              </span>
            </div>
            <span className="font-semibold flex-1 text-left">Корзина</span>
            {hasTotal && (
              <span className="font-semibold">
                {totalValue.toLocaleString("ru-RU")} ₽
              </span>
            )}
          </button>
        </div>
      )}

      {/* Drawer корзины */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            aria-label="Закрыть"
            onClick={() => { setCartOpen(false); setOrderStep("cart"); }}
          />
          <div
            className="relative w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col border backdrop-blur-xl"
            style={panelStyle(isBg)}
          >
            {/* Шапка */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: isBg ? "rgba(255,255,255,0.1)" : "var(--brand-border)" }}>
              <h2 id="cart-title" className="text-lg font-bold" style={{ color: headingColor(isBg) }}>
                {orderStep === "success" ? "Заказ принят!" : orderStep === "form" ? "Оформление заказа" : "Корзина"}
              </h2>
              <button
                type="button"
                onClick={() => { setCartOpen(false); setOrderStep("cart"); }}
                className={`p-2 rounded-full hover:scale-105 transition-transform ${isBg ? "bg-white/10 text-white hover:bg-white/20" : dark ? "bg-slate-700 text-slate-300" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Контент */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {orderStep === "success" && (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">✅</div>
                  <p className="font-semibold text-lg mb-2" style={{ color: headingColor(isBg) }}>Заказ отправлен!</p>
                  <p className="text-sm" style={{ color: mutedColor(isBg) }}>
                    Ваш заказ передан персоналу. Ожидайте, пожалуйста.
                  </p>
                  {isDemo && (
                    <p className="text-xs mt-3 px-3 py-2 rounded-lg" style={{ backgroundColor: isBg ? "rgba(255,255,255,0.1)" : "var(--brand-row-bg)", color: mutedColor(isBg) }}>
                      Это демо-режим. В реальном меню заказ уйдёт в Telegram / email заведения.
                    </p>
                  )}
                </div>
              )}

              {orderStep === "cart" && (
                <>
                  {cart.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: mutedColor(isBg) }} />
                      <p style={{ color: mutedColor(isBg) }}>Корзина пуста</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map(({ item, qty }) => {
                        const key = item.id ?? item.name;
                        const linePrice = (() => {
                          const p = parsePrice(item.price);
                          if (p === null) return null;
                          return (p * qty).toLocaleString("ru-RU") + " ₽";
                        })();
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-3 py-2 border-b"
                            style={{ borderColor: isBg ? "rgba(255,255,255,0.08)" : "var(--brand-border)" }}
                          >
                            {item.imageUrl && (
                              <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm leading-tight" style={{ color: headingColor(isBg) }}>
                                {item.name}
                              </p>
                              {item.price && (
                                <p className="text-xs mt-0.5" style={{ color: mutedColor(isBg) }}>{item.price}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => removeFromCart(item)}
                                className="w-7 h-7 rounded-full flex items-center justify-center"
                                style={isBg ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#fff" } : { backgroundColor: "var(--brand-row-bg)", color: "var(--brand-heading)" }}
                                aria-label="Уменьшить"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-5 text-center font-semibold text-sm" style={{ color: headingColor(isBg) }}>{qty}</span>
                              <button
                                type="button"
                                onClick={() => addToCart(item)}
                                className="w-7 h-7 rounded-full flex items-center justify-center"
                                style={primaryButtonStyle()}
                                aria-label="Увеличить"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeCartItem(item)}
                                className={`w-7 h-7 rounded-full flex items-center justify-center ml-1 ${isBg ? "text-red-300 hover:bg-red-400/20" : "text-red-400 hover:bg-red-50"}`}
                                aria-label="Удалить"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {linePrice && (
                              <p className="text-sm font-semibold shrink-0 ml-1" style={{ color: headingColor(isBg) }}>
                                {linePrice}
                              </p>
                            )}
                          </div>
                        );
                      })}

                      {hasTotal && (
                        <div className="flex justify-between items-center pt-1">
                          <span className="font-semibold" style={{ color: headingColor(isBg) }}>Итого</span>
                          <span className="font-bold text-lg" style={{ color: headingColor(isBg) }}>
                            {totalValue.toLocaleString("ru-RU")} ₽
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {orderStep === "form" && (
                <div className="space-y-4">
                  {/* Краткое резюме заказа */}
                  <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: isBg ? "rgba(255,255,255,0.08)" : "var(--brand-row-bg)" }}>
                    {cart.map((c) => (
                      <div key={c.item.id ?? c.item.name} className="flex justify-between gap-2" style={{ color: mutedColor(isBg) }}>
                        <span>{c.item.name} ×{c.qty}</span>
                        {c.item.price && <span>{c.item.price}</span>}
                      </div>
                    ))}
                    {hasTotal && (
                      <div className="flex justify-between font-semibold mt-1 pt-1 border-t" style={{ borderColor: isBg ? "rgba(255,255,255,0.1)" : "var(--brand-border)", color: headingColor(isBg) }}>
                        <span>Итого</span>
                        <span>{totalValue.toLocaleString("ru-RU")} ₽</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {isIikoMenu && (
                      <FormField label="Способ получения" isBg={isBg}>
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              { id: "pickup" as const, label: "Самовывоз" },
                              { id: "delivery" as const, label: "Доставка" },
                            ] as const
                          ).map(({ id, label }) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setFulfillment(id)}
                              className="px-3 py-2 rounded-xl text-sm font-medium border transition-colors"
                              style={
                                fulfillment === id
                                  ? activePillStyle()
                                  : fieldStyle(isBg)
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </FormField>
                    )}

                    {/* Имя — всегда */}
                    <FormField label="Ваше имя *" isBg={isBg}>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Как к вам обращаться?"
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2"
                        style={fieldStyle(isBg)}
                      />
                    </FormField>

                    {/* Номер стола — всегда */}
                    <FormField label="Номер стола" isBg={isBg}>
                      <input
                        type="text"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        placeholder="Например: 5"
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2"
                        style={fieldStyle(isBg)}
                      />
                    </FormField>

                    {/* Телефон — опционально или обязателен для iiko */}
                    {(menu.askPhone || isIikoMenu) && (
                      phoneEmailAllowed ? (
                        <FormField label={isIikoMenu ? "Телефон *" : "Телефон"} isBg={isBg}>
                          <input
                            type="tel"
                            value={guestPhone}
                            onChange={(e) => setGuestPhone(e.target.value)}
                            placeholder="+7 900 000-00-00"
                            className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2"
                            style={fieldStyle(isBg)}
                          />
                        </FormField>
                      ) : (
                        <div className={`text-xs px-3 py-2 rounded-xl border ${isBg ? "border-white/20 text-white/50" : "border-gray-200 text-gray-400 bg-gray-50"}`}>
                          Поле телефона недоступно — требуется настройка реквизитов заведения.
                        </div>
                      )
                    )}

                    {/* Email — опционально */}
                    {menu.askEmail && (
                      phoneEmailAllowed ? (
                        <FormField label="Email" isBg={isBg}>
                          <input
                            type="email"
                            value={guestEmail}
                            onChange={(e) => setGuestEmail(e.target.value)}
                            placeholder="mail@example.com"
                            className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2"
                            style={fieldStyle(isBg)}
                          />
                        </FormField>
                      ) : (
                        <div className={`text-xs px-3 py-2 rounded-xl border ${isBg ? "border-white/20 text-white/50" : "border-gray-200 text-gray-400 bg-gray-50"}`}>
                          Поле email недоступно — требуется настройка реквизитов заведения.
                        </div>
                      )
                    )}

                    {/* Адрес — опционально или для доставки iiko */}
                    {(menu.askAddress || (isIikoMenu && fulfillment === "delivery")) && (
                      <FormField
                        label={isIikoMenu && fulfillment === "delivery" ? "Адрес доставки *" : "Адрес доставки"}
                        isBg={isBg}
                      >
                        <textarea
                          value={guestAddress}
                          onChange={(e) => setGuestAddress(e.target.value)}
                          placeholder="Улица, дом, квартира"
                          rows={2}
                          className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 resize-none"
                          style={fieldStyle(isBg)}
                        />
                      </FormField>
                    )}

                    {/* Комментарий — всегда */}
                    <FormField label="Комментарий" isBg={isBg}>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Аллергены, пожелания к подаче..."
                        rows={2}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 resize-none"
                        style={fieldStyle(isBg)}
                      />
                    </FormField>
                  </div>

                  {needsConsent && phoneEmailAllowed && (
                    <ConsentCheckbox
                      checked={consentChecked}
                      onChange={setConsentChecked}
                      policyUrl={pdConsent!.policyUrl}
                      isBg={isBg}
                    />
                  )}

                  {submitError && (
                    <p className="text-sm text-red-500">{submitError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Футер с кнопками */}
            {orderStep !== "success" && (
              <div className="p-5 border-t space-y-2" style={{ borderColor: isBg ? "rgba(255,255,255,0.1)" : "var(--brand-border)" }}>
                {orderStep === "cart" && (
                  <>
                    <button
                      type="button"
                      disabled={cart.length === 0}
                      onClick={() => { setOrderStep("form"); setSubmitError(null); }}
                      className="w-full py-3 rounded-xl font-semibold transition-opacity disabled:opacity-40"
                      style={primaryButtonStyle()}
                    >
                      Оформить заказ
                    </button>
                    <button
                      type="button"
                      onClick={() => setCartOpen(false)}
                      className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
                      style={isBg ? { color: "rgba(255,255,255,0.7)" } : { color: "var(--brand-muted)" }}
                    >
                      Продолжить выбор
                    </button>
                  </>
                )}
                {orderStep === "form" && (
                  <>
                    <button
                      type="button"
                      disabled={submitting || (needsConsent && phoneEmailAllowed && !consentChecked)}
                      onClick={handleSubmitOrder}
                      className="w-full py-3 rounded-xl font-semibold transition-opacity disabled:opacity-60"
                      style={primaryButtonStyle()}
                    >
                      {submitting ? "Отправка..." : "Отправить заказ"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderStep("cart")}
                      className="w-full py-2.5 rounded-xl text-sm font-medium"
                      style={isBg ? { color: "rgba(255,255,255,0.7)" } : { color: "var(--brand-muted)" }}
                    >
                      ← Назад в корзину
                    </button>
                  </>
                )}
              </div>
            )}

            {orderStep === "success" && (
              <div className="p-5 border-t" style={{ borderColor: isBg ? "rgba(255,255,255,0.1)" : "var(--brand-border)" }}>
                <button
                  type="button"
                  onClick={() => { setCartOpen(false); setOrderStep("cart"); }}
                  className="w-full py-3 rounded-xl font-semibold"
                  style={primaryButtonStyle()}
                >
                  Отлично!
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-item-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            aria-label="Закрыть"
            onClick={() => setSelectedItem(null)}
          />
          <div
            className="relative w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto border backdrop-blur-xl"
            style={panelStyle(isBg)}
          >
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className={`absolute top-3 right-3 z-10 p-2 rounded-full shadow hover:scale-105 transition-transform ${
                isBg ? "bg-white/10 text-white hover:bg-white/20" : dark ? "bg-slate-700 text-slate-300" : "bg-white/90 text-gray-600 hover:bg-gray-100"
              }`}
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>

            {selectedItem.imageUrl && (
              <button
                type="button"
                onClick={() => setLightboxUrl(selectedItem.imageUrl!)}
                className={`w-full aspect-[4/3] block ${isBg ? "bg-white/5" : dark ? "bg-slate-700" : "bg-gray-100"}`}
                aria-label="Увеличить фото"
              >
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.name}
                  className="w-full h-full object-cover"
                />
              </button>
            )}

            <div className="p-5 space-y-3">
              <div className="flex justify-between items-start gap-3 pr-8">
                <h2 id="menu-item-title" className="text-xl font-bold" style={{ color: headingColor(isBg) }}>
                  {selectedItem.name}
                </h2>
                {selectedItem.price && (
                  <span className="font-semibold px-3 py-1 rounded-lg shrink-0" style={priceTagStyle(isBg)}>
                    {selectedItem.price}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedItem.weight && (
                  <span className={`text-sm px-2.5 py-1 rounded-lg ${
                    isBg ? "bg-white/10 text-white/70" : dark ? "text-slate-400 bg-slate-700" : "text-gray-600 bg-gray-100"
                  }`}>
                    {selectedItem.weight}
                  </span>
                )}
                {selectedItem.category && (
                  <span className={`text-sm ${isBg ? "text-white/50" : dark ? "text-slate-500" : "text-gray-500"}`}>{selectedItem.category}</span>
                )}
              </div>
              {selectedItem.description ? (
                <p className={`leading-relaxed whitespace-pre-line ${isBg ? "text-white/80" : dark ? "text-slate-300" : "text-gray-600"}`}>
                  {selectedItem.description}
                </p>
              ) : (
                <p className={`text-sm ${isBg ? "text-white/40" : dark ? "text-slate-500" : "text-gray-400"}`}>Описание не указано</p>
              )}

              {cartEnabled && (
                <div className="pt-2">
                  {qtyInCart(selectedItem) === 0 ? (
                    <button
                      type="button"
                      onClick={() => { addToCart(selectedItem); setSelectedItem(null); }}
                      className="w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2"
                      style={primaryButtonStyle()}
                    >
                      <Plus className="w-4 h-4" />
                      Добавить в корзину
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-4">
                      <button type="button" onClick={() => removeFromCart(selectedItem)} className="w-9 h-9 rounded-full flex items-center justify-center" style={isBg ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#fff" } : { backgroundColor: "var(--brand-row-bg)", color: "var(--brand-heading)" }}>
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-bold text-lg" style={{ color: headingColor(isBg) }}>{qtyInCart(selectedItem)}</span>
                      <button type="button" onClick={() => addToCart(selectedItem)} className="w-9 h-9 rounded-full flex items-center justify-center" style={primaryButtonStyle()}>
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Увеличенное фото"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Закрыть"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
