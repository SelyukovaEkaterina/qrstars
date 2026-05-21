"use client";

import { useMemo, useRef, useState } from "react";
import { type MenuData, type MenuItemData } from "@/components/dashboard/MenuEditor";
import { Search, X } from "lucide-react";
import { getLandingTheme, isDarkLandingTheme } from "@/lib/landing-themes";

interface MenuViewProps {
  menu: MenuData;
  establishmentName?: string;
  embedded?: boolean;
  landingTheme?: string | null;
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
}: {
  item: MenuItemData;
  onOpen: () => void;
  compact?: boolean;
  theme: ReturnType<typeof getLandingTheme>;
  dark: boolean;
}) {
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
      className={`w-full text-left ${theme.cardBg} shadow-sm border ${theme.cardBorder} flex transition-transform active:scale-[0.98] ${theme.hoverBorder} cursor-pointer ${
        compact ? "p-3 gap-3 rounded-xl" : "p-4 gap-4 rounded-2xl"
      }`}
    >
      {item.imageUrl && (
        <div
          className={`rounded-xl overflow-hidden shrink-0 ${dark ? "bg-slate-700" : "bg-gray-100"} ${
            compact ? "w-16 h-16" : "w-24 h-24 sm:w-32 sm:h-32"
          }`}
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
          <h3 className={`font-bold leading-tight ${dark ? "text-white" : "text-gray-900"}`}>{item.name}</h3>
          {item.price && (
            <span className={`font-semibold whitespace-nowrap ${theme.priceBg} ${theme.priceText} px-2 py-0.5 rounded-lg text-sm`}>
              {item.price}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          {item.weight && (
            <span className={`text-xs px-2 py-0.5 rounded-md ${dark ? "text-slate-400 bg-slate-700" : "text-gray-500 bg-gray-100"}`}>
              {item.weight}
            </span>
          )}
          {item.description && (
            <span className={`text-xs ${dark ? "text-indigo-400" : theme.priceText}`}>Подробнее →</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MenuView({ menu, establishmentName, embedded, landingTheme: themeId }: MenuViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItemData | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const theme = getLandingTheme(themeId);
  const dark = isDarkLandingTheme(themeId);

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

  const rootBg = embedded
    ? (dark ? "min-h-0 h-full bg-slate-900 pb-6" : "min-h-0 h-full bg-gray-50 pb-6")
    : (dark ? "min-h-screen bg-slate-900 pb-10" : "min-h-screen bg-gray-50 pb-10");
  const containerClass = embedded ? "px-3 py-3 space-y-3" : "max-w-xl mx-auto px-4 py-4 space-y-3";
  const contentClass = embedded ? "px-3 py-4 space-y-6" : "max-w-xl mx-auto px-4 py-6 space-y-8";
  const scrollMt = embedded ? "scroll-mt-32" : "scroll-mt-44";

  return (
    <div className={rootBg}>
      <div className={`${dark ? "bg-slate-800" : "bg-white"} shadow-sm sticky top-0 z-20`}>
        <div className={containerClass}>
          <div className="text-center">
            {establishmentName && (
              <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${dark ? "text-slate-400" : "text-gray-500"}`}>
                {establishmentName}
              </p>
            )}
            <h1 className={`font-bold ${dark ? "text-white" : "text-gray-900"} ${embedded ? "text-lg" : "text-2xl"}`}>
              {menu.title || "Меню"}
            </h1>
            {menu.description && (
              <p className={`text-sm mt-1 ${dark ? "text-slate-400" : "text-gray-500"}`}>{menu.description}</p>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className={`h-5 w-5 ${dark ? "text-slate-500" : "text-gray-400"}`} />
            </div>
            <input
              type="text"
              className={`block w-full pl-10 pr-3 py-2 border rounded-xl leading-5 ${
                dark
                  ? "bg-slate-700 border-slate-600 placeholder-slate-500 text-white focus:ring-indigo-400 focus:border-indigo-400"
                  : `bg-gray-50 placeholder-gray-500 ${theme.inputBorder}`
              } sm:text-sm transition-colors focus:outline-none focus:bg-white`}
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
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeCategory === cat
                      ? `${theme.activePillBg} ${theme.activePillText}`
                      : dark
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
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
            <p className={dark ? "text-slate-400" : "text-gray-500"}>
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
              <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${dark ? "text-white" : "text-gray-900"}`}>
                <span className={`w-1 h-5 rounded-full ${theme.sectionBar}`} />
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
          <p className={`text-xs ${dark ? "text-slate-500" : "text-gray-400"}`}>Сделано в QrStars.ru</p>
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
            className="absolute inset-0 bg-black/50"
            aria-label="Закрыть"
            onClick={() => setSelectedItem(null)}
          />
          <div className={`relative w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto ${dark ? "bg-slate-800" : "bg-white"}`}>
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className={`absolute top-3 right-3 z-10 p-2 rounded-full shadow hover:bg-gray-100 ${dark ? "bg-slate-700 text-slate-300" : "bg-white/90 text-gray-600"}`}
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>

            {selectedItem.imageUrl && (
              <button
                type="button"
                onClick={() => setLightboxUrl(selectedItem.imageUrl!)}
                className={`w-full aspect-[4/3] block ${dark ? "bg-slate-700" : "bg-gray-100"}`}
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
                <h2 id="menu-item-title" className={`text-xl font-bold ${dark ? "text-white" : "text-gray-900"}`}>
                  {selectedItem.name}
                </h2>
                {selectedItem.price && (
                  <span className={`font-semibold ${theme.priceBg} ${theme.priceText} px-3 py-1 rounded-lg shrink-0`}>
                    {selectedItem.price}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedItem.weight && (
                  <span className={`text-sm px-2.5 py-1 rounded-lg ${dark ? "text-slate-400 bg-slate-700" : "text-gray-600 bg-gray-100"}`}>
                    {selectedItem.weight}
                  </span>
                )}
                {selectedItem.category && (
                  <span className={`text-sm ${dark ? "text-slate-500" : "text-gray-500"}`}>{selectedItem.category}</span>
                )}
              </div>
              {selectedItem.description ? (
                <p className={`leading-relaxed whitespace-pre-line ${dark ? "text-slate-300" : "text-gray-600"}`}>
                  {selectedItem.description}
                </p>
              ) : (
                <p className={`text-sm ${dark ? "text-slate-500" : "text-gray-400"}`}>Описание не указано</p>
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
