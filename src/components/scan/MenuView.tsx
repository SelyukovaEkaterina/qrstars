"use client";

import { useMemo, useRef, useState } from "react";
import { type MenuData, type MenuItemData } from "@/components/dashboard/MenuEditor";
import { Search, X } from "lucide-react";
import type { BrandTheme } from "@/lib/brand-theme";
import {
  activePillStyle,
  headingColor,
  headerBarStyle,
  mutedColor,
  panelStyle,
  priceTagStyle,
  scanRootStyle,
  sectionAccentStyle,
  submutedColor,
  coverOverlayStyle,
} from "@/lib/brand-theme-ui";
import { useBrandThemeScan, type BrandThemeScanProps } from "@/components/scan/brand-theme-props";

interface MenuViewProps extends BrandThemeScanProps {
  menu: MenuData;
  establishmentName?: string;
  embedded?: boolean;
  isBg?: boolean;
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

function MenuItemCard({
  item,
  onOpen,
  compact,
  theme,
  dark,
  isBg,
}: {
  item: MenuItemData;
  onOpen: () => void;
  compact?: boolean;
  theme: BrandTheme;
  dark: boolean;
  isBg?: boolean;
}) {
  const cardSurface = isBg
    ? { backgroundColor: "var(--brand-cover-module-bg)", borderColor: "var(--brand-cover-module-border)" }
    : { backgroundColor: "var(--brand-module-bg)", borderColor: "var(--brand-module-border)" };
  const imgBg = isBg
    ? { backgroundColor: "var(--brand-cover-module-bg)" }
    : { backgroundColor: "var(--brand-row-bg)" };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`w-full text-left shadow-sm flex transition-transform active:scale-[0.98] cursor-pointer border backdrop-blur-md hover:shadow-md ${
        compact ? "p-3 gap-3 rounded-xl" : "p-4 gap-4 rounded-2xl"
      }`}
      style={cardSurface}
    >
      {item.imageUrl && (
        <div
          className={`rounded-xl overflow-hidden shrink-0 ${
            compact ? "w-16 h-16" : "w-24 h-24 sm:w-32 sm:h-32"
          }`}
          style={imgBg}
        >
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-between items-start gap-2 mb-1">
          <h3 className="font-bold leading-tight" style={{ color: headingColor(isBg) }}>
            {item.name}
          </h3>
          {item.price && (
            <span
              className="font-semibold whitespace-nowrap px-2 py-0.5 rounded-lg text-sm"
              style={priceTagStyle(isBg)}
            >
              {item.price}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          {item.weight && (
            <span
              className="text-xs px-2 py-0.5 rounded-md"
                  style={
                    isBg
                      ? { backgroundColor: "var(--brand-cover-module-bg)", color: "rgba(255,255,255,0.75)" }
                      : { backgroundColor: "var(--brand-row-bg)", color: "var(--brand-muted)" }
                  }
            >
              {item.weight}
            </span>
          )}
          {item.description && (
            <span className="text-xs" style={{ color: mutedColor(isBg) }}>
              Подробнее →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MenuView({ menu, establishmentName, embedded, brandColor, pageAppearance, isBg }: MenuViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItemData | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

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

  const rootClass = embedded
    ? "min-h-0 h-full pb-6 relative z-10"
    : isBg
      ? "min-h-screen pb-10 relative z-10"
      : "min-h-screen pb-10";
  const containerClass = embedded ? "px-3 py-3 space-y-3" : "max-w-xl mx-auto px-4 py-4 space-y-3";
  const contentClass = embedded ? "px-3 py-4 space-y-6" : "max-w-xl mx-auto px-4 py-6 space-y-8";
  const scrollMt = embedded ? "scroll-mt-32" : "scroll-mt-44";

  return (
    <div className={rootClass} style={scanRootStyle(theme, { isBg, embedded })}>
      <div
        className="sticky top-0 z-20 backdrop-blur-md shadow-sm border-b"
        style={headerBarStyle(isBg, dark)}
      >
        <div className={containerClass}>
          <div className="text-center">
            {establishmentName && (
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: mutedColor(isBg) }}>
                {establishmentName}
              </p>
            )}
            <h1
              className={`font-bold ${embedded ? "text-lg" : "text-2xl"}`}
              style={{ color: headingColor(isBg) }}
            >
              {menu.title || "Меню"}
            </h1>
            {menu.description && (
              <p className="text-sm mt-1" style={{ color: mutedColor(isBg) }}>
                {menu.description}
              </p>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className={`h-5 w-5 ${isBg ? "text-white/50" : dark ? "text-slate-500" : "text-gray-400"}`} />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border rounded-xl leading-5 sm:text-sm transition-colors focus:outline-none focus:ring-2 backdrop-blur-sm"
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
                className="text-lg font-bold mb-4 flex items-center gap-2"
                style={{ color: headingColor(isBg) }}
              >
                <span
                  className="w-1 h-5 rounded-full"
                  style={isBg ? { backgroundColor: "var(--brand-500)" } : sectionAccentStyle()}
                />
                {category}
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {items.map((item) => (
                  <MenuItemCard
                    key={item.id || item.name}
                    item={item}
                    onOpen={() => setSelectedItem(item)}
                    compact={embedded}
                    theme={theme}
                    dark={dark}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {!embedded && (
        <div className="text-center mt-8 pb-4">
          <p className="text-xs" style={{ color: submutedColor(isBg) }}>
            Сделано в QrStars.ru
          </p>
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
