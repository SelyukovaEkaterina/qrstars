"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { CheckCircle2, Eye, EyeOff, Loader2, Plug, Search } from "lucide-react";
import type { MenuData } from "@/components/dashboard/MenuEditor";

type IikoCategoryRow = {
  id: string;
  name: string;
  itemCount: number;
  visible: boolean;
};

type DiscoverData = {
  organizations: { id: string; name: string }[];
  externalMenus: { id: string; name: string }[];
  terminals: { id: string; name: string; organizationId: string }[];
  paymentTypes: { id: string; code: string | null; name: string }[];
  orderTypes: { id: string; name: string; orderServiceType: string }[];
  suggested: {
    organizationId: string | null;
    externalMenuId: string | null;
    terminalGroupId: string | null;
    paymentTypeId: string | null;
    orderTypePickupId: string | null;
    orderTypeDeliveryId: string | null;
  };
};

interface IikoMenuSettingsProps {
  menu: MenuData;
  establishmentId?: string;
  isPro: boolean;
  onChange: (patch: Partial<MenuData>) => void;
  onPreviewLoaded?: (menu: MenuData) => void;
}

function hiddenListsEqual(a: string[] | undefined, b: string[]): boolean {
  const sa = [...(a ?? [])].sort().join("\0");
  const sb = [...b].sort().join("\0");
  return sa === sb;
}

export default function IikoMenuSettings({
  menu,
  establishmentId,
  isPro,
  onChange,
  onPreviewLoaded,
}: IikoMenuSettingsProps) {
  const [apiLogin, setApiLogin] = useState("");
  const [discover, setDiscover] = useState<DiscoverData | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(!!menu.iikoApiLoginSaved);
  const [categories, setCategories] = useState<IikoCategoryRow[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const fetchGenRef = useRef(0);

  const hiddenSet = useMemo(
    () => new Set(menu.iikoHiddenCategoryIds ?? []),
    [menu.iikoHiddenCategoryIds]
  );

  const canLoadCategories =
    !!menu.id &&
    !!establishmentId &&
    !!menu.iikoOrganizationId &&
    !!menu.iikoExternalMenuId &&
    (menu.iikoApiLoginSaved || !!apiLogin.trim());

  const applyCategoriesFromApi = useCallback(
    (
      rows: IikoCategoryRow[],
      prunedHidden: string[],
      menuPayload?: MenuData
    ) => {
      setCategories(rows);
      if (!hiddenListsEqual(menu.iikoHiddenCategoryIds, prunedHidden)) {
        onChange({ iikoHiddenCategoryIds: prunedHidden });
      }
      if (menuPayload) {
        onPreviewLoaded?.(menuPayload);
      }
    },
    [menu.iikoHiddenCategoryIds, onChange, onPreviewLoaded]
  );

  const loadCategories = useCallback(async () => {
      if (!canLoadCategories) return false;

      const gen = ++fetchGenRef.current;
      setCategoriesLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/menus/iiko/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            menuId: menu.id,
            establishmentId,
            iikoOrganizationId: menu.iikoOrganizationId,
            iikoExternalMenuId: menu.iikoExternalMenuId,
            iikoHiddenCategoryIds: menu.iikoHiddenCategoryIds ?? [],
          }),
        });
        const data = await res.json();
        if (gen !== fetchGenRef.current) return false;

        if (!res.ok) {
          setError(data.error || "Не удалось загрузить меню");
          setCategories([]);
          return false;
        }

        const rows: IikoCategoryRow[] = (data.categories ?? []).map(
          (c: { id: string; name: string; itemCount: number; visible: boolean }) => ({
            id: c.id,
            name: c.name,
            itemCount: c.itemCount,
            visible: c.visible,
          })
        );
        const hidden: string[] = data.config?.iikoHiddenCategoryIds ?? [];
        applyCategoriesFromApi(rows, hidden, data.menu);
        return true;
      } catch {
        if (gen === fetchGenRef.current) {
          setError("Ошибка загрузки меню iiko");
        }
        return false;
      } finally {
        if (gen === fetchGenRef.current) {
          setCategoriesLoading(false);
        }
      }
    },
    [
      canLoadCategories,
      menu.id,
      menu.iikoOrganizationId,
      menu.iikoExternalMenuId,
      establishmentId,
      applyCategoriesFromApi,
    ]
  );

  useEffect(() => {
    setCategories((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((c) => ({ ...c, visible: !hiddenSet.has(c.id) }));
    });
  }, [menu.iikoHiddenCategoryIds, hiddenSet]);

  const categoryFetchKey = [
    menu.id,
    menu.iikoOrganizationId,
    menu.iikoExternalMenuId,
    menu.iikoApiLoginSaved,
    establishmentId,
  ].join("|");

  useEffect(() => {
    if (!canLoadCategories) {
      setCategories([]);
      return;
    }
    const t = setTimeout(() => {
      void loadCategories();
    }, 400);
    return () => clearTimeout(t);
  }, [categoryFetchKey, canLoadCategories, loadCategories]);

  const runDiscover = async () => {
    if (!establishmentId) {
      setError("Сначала выберите заведение");
      return;
    }
    if (!apiLogin.trim() && !menu.iikoApiLoginSaved) {
      setError("Введите API-login iiko");
      return;
    }
    setDiscovering(true);
    setError(null);
    try {
      const res = await fetch("/api/menus/iiko/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establishmentId,
          menuId: menu.id,
          ...(apiLogin.trim() ? { apiLogin: apiLogin.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка подключения");
        return;
      }
      setDiscover(data);
      setConnected(true);
      const s = data.suggested;
      onChange({
        iikoOrganizationId: s.organizationId,
        iikoExternalMenuId: s.externalMenuId,
        iikoTerminalGroupId: s.terminalGroupId,
        iikoPaymentTypeId: s.paymentTypeId,
        iikoOrderTypePickupId: s.orderTypePickupId,
        iikoOrderTypeDeliveryId: s.orderTypeDeliveryId,
        ...(apiLogin.trim() ? { iikoApiLogin: apiLogin.trim() } : {}),
      });
    } catch {
      setError("Не удалось подключиться к iiko");
    } finally {
      setDiscovering(false);
    }
  };

  const setCategoryVisible = (id: string, visible: boolean) => {
    const nextHidden = new Set(hiddenSet);
    if (visible) {
      nextHidden.delete(id);
    } else {
      nextHidden.add(id);
    }
    const hidden = Array.from(nextHidden);
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible } : c))
    );
    onChange({ iikoHiddenCategoryIds: hidden });
  };

  const setAllVisible = (visible: boolean) => {
    if (visible) {
      setCategories((prev) => prev.map((c) => ({ ...c, visible: true })));
      onChange({ iikoHiddenCategoryIds: [] });
    } else {
      const allIds = categories.map((c) => c.id);
      setCategories((prev) => prev.map((c) => ({ ...c, visible: false })));
      onChange({ iikoHiddenCategoryIds: allIds });
    }
  };

  const filteredCategories = categories.filter((c) =>
    categorySearch.trim()
      ? c.name.toLowerCase().includes(categorySearch.trim().toLowerCase())
      : true
  );

  const visibleCount = categories.filter((c) => c.visible).length;

  if (!isPro) {
    return (
      <p className="text-sm text-amber-700">
        Интеграция iiko доступна на тарифе PRO и Сеть.
      </p>
    );
  }

  const orgs = discover?.organizations ?? [];
  const menus = discover?.externalMenus ?? [];
  const terminals =
    discover?.terminals.filter(
      (t) => !menu.iikoOrganizationId || t.organizationId === menu.iikoOrganizationId
    ) ?? discover?.terminals ?? [];
  const payments = discover?.paymentTypes ?? [];
  const orderTypes = discover?.orderTypes ?? [];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">API-login iiko</label>
        <Input
          type="password"
          value={apiLogin}
          onChange={(e) => setApiLogin(e.target.value)}
          placeholder={menu.iikoApiLoginSaved ? "Сохранён — введите новый для замены" : "Ключ из iikoCloud"}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={runDiscover} disabled={discovering}>
          {discovering ? (
            <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Проверка...</>
          ) : (
            <><Plug className="w-4 h-4 mr-1" />Проверить подключение</>
          )}
        </Button>
        {menu.id && connected && canLoadCategories && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadCategories()}
            disabled={categoriesLoading}
          >
            {categoriesLoading ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Обновление...</>
            ) : (
              "Обновить список"
            )}
          </Button>
        )}
      </div>

      {connected && (
        <p className="text-sm text-green-700 flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4" /> Подключение настроено
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!menu.id && connected && (
        <p className="text-sm text-amber-700">
          Сохраните меню — после этого категории подтянутся автоматически.
        </p>
      )}

      {(discover || menu.iikoOrganizationId) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Организация</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={menu.iikoOrganizationId || ""}
              onChange={(e) => onChange({ iikoOrganizationId: e.target.value || null })}
            >
              <option value="">—</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Внешнее меню</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={menu.iikoExternalMenuId || ""}
              onChange={(e) => onChange({ iikoExternalMenuId: e.target.value || null })}
            >
              <option value="">—</option>
              {menus.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Терминальная группа</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={menu.iikoTerminalGroupId || ""}
              onChange={(e) => onChange({ iikoTerminalGroupId: e.target.value || null })}
            >
              <option value="">—</option>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Тип оплаты (SITE)</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={menu.iikoPaymentTypeId || ""}
              onChange={(e) => onChange({ iikoPaymentTypeId: e.target.value || null })}
            >
              <option value="">—</option>
              {payments.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Самовывоз</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={menu.iikoOrderTypePickupId || ""}
              onChange={(e) => onChange({ iikoOrderTypePickupId: e.target.value || null })}
            >
              <option value="">—</option>
              {orderTypes.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Доставка</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={menu.iikoOrderTypeDeliveryId || ""}
              onChange={(e) => onChange({ iikoOrderTypeDeliveryId: e.target.value || null })}
            >
              <option value="">—</option>
              {orderTypes.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {(categories.length > 0 || categoriesLoading) && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Категории в QR-меню</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                {categoriesLoading && categories.length === 0
                  ? "Загружаем категории из iiko…"
                  : `Снимите галочку, чтобы скрыть раздел. Показано: ${visibleCount} из ${categories.length}`}
              </p>
            </div>
            {categories.length > 0 && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAllVisible(true)}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> Все
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAllVisible(false)}>
                  <EyeOff className="w-3.5 h-3.5 mr-1" /> Скрыть все
                </Button>
              </div>
            )}
          </div>

          {categoriesLoading && categories.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загрузка…
            </div>
          )}

          {categories.length > 8 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Поиск категории..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
              />
            </div>
          )}

          <ul className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {filteredCategories.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.visible}
                    onChange={(e) => setCategoryVisible(c.id, e.target.checked)}
                    disabled={categoriesLoading}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="flex-1 text-sm text-gray-800">{c.name}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{c.itemCount} поз.</span>
                </label>
              </li>
            ))}
          </ul>

          {visibleCount === 0 && categories.length > 0 && (
            <p className="text-xs text-amber-700">
              Все категории скрыты — гости не увидят позиций. Включите хотя бы одну.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Категории подгружаются из iiko автоматически. Позиции редактируются в iikoWeb → Внешние меню.
        Не забудьте сохранить меню после изменений.
      </p>
    </div>
  );
}
