"use client";

import { useState } from "react";
import { useSyncPropState } from "@/lib/sync-prop-state";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Loader2, Save, Upload, X } from "lucide-react";
import {
  type LandingTipsPayload,
  type TipsMode,
  validateLandingTips,
} from "@/lib/tips-config";

export interface TipsEmployeeItem {
  id?: string;
  name: string;
  photoUrl?: string | null;
  paymentType: "LINK" | "PHONE";
  paymentUrl?: string;
  phone?: string;
  bankName?: string;
  uploading?: boolean;
  _localId: string;
}

interface TipsSettingsEditorProps {
  establishmentId: string;
  initialType?: TipsMode | null;
  initialPhone?: string | null;
  initialBankName?: string | null;
  initialUrl?: string | null;
  initialEmployees?: TipsEmployeeItem[];
  onSave: (payload: LandingTipsPayload) => Promise<void>;
  saving?: boolean;
}

export default function TipsSettingsEditor({
  establishmentId,
  initialType,
  initialPhone,
  initialBankName,
  initialUrl,
  initialEmployees = [],
  onSave,
  saving,
}: TipsSettingsEditorProps) {
  const [tipsType, setTipsType] = useSyncPropState<TipsMode>(
    initialType || "PHONE",
    `${establishmentId}-${initialType}`
  );
  const [tipsUrl, setTipsUrl] = useSyncPropState(
    initialUrl || "",
    `${establishmentId}-url-${initialUrl}`
  );
  const [tipsPhone, setTipsPhone] = useSyncPropState(
    initialPhone || "",
    `${establishmentId}-phone-${initialPhone}`
  );
  const [tipsBankName, setTipsBankName] = useSyncPropState(
    initialBankName || "",
    `${establishmentId}-bank-${initialBankName}`
  );
  const [employees, setEmployees] = useState<TipsEmployeeItem[]>(
    initialEmployees.map((e) => ({ ...e, _localId: e._localId || e.id || Math.random().toString(36).slice(2) }))
  );
  const [error, setError] = useState("");

  const handleSave = async () => {
    const payload: LandingTipsPayload = {
      landingTipsType: tipsType,
      landingTipsPhone: tipsType === "PHONE" ? tipsPhone || null : null,
      landingTipsBankName: tipsType === "PHONE" ? tipsBankName || null : null,
      landingTipsUrl: tipsType === "REDIRECT" ? tipsUrl || null : null,
    };
    const validationError = validateLandingTips(payload);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (tipsType === "EMPLOYEES" && employees.length === 0) {
      setError("Добавьте хотя бы одного сотрудника");
      return;
    }
    if (tipsType === "EMPLOYEES") {
      const hasEmpty = employees.some((e) => !e.name.trim());
      if (hasEmpty) {
        setError("Укажите имя для каждого сотрудника");
        return;
      }
    }
    setError("");
    await onSave(payload);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Чаевые</h3>
      <p className="text-sm text-gray-500 -mt-2">
        Настройка один раз для заведения. QR с маршрутом «Чаевые» или разделом «Чаевые» на лендинге
        откроют эту страницу.
      </p>

      <div className="grid grid-cols-3 gap-2">
        {([
          { t: "REDIRECT" as const, icon: "🔗", label: "Сервис чаевых", desc: "CloudTips, ЮMoney…" },
          { t: "PHONE" as const, icon: "📱", label: "По номеру", desc: "Перевод СБП" },
          { t: "EMPLOYEES" as const, icon: "👥", label: "Выбор сотрудника", desc: "Список команды" },
        ]).map(({ t, icon, label, desc }) => {
          const sel = tipsType === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTipsType(t)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                sel ? "border-indigo-600 bg-indigo-50" : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="text-lg mb-1">{icon}</div>
              <div className={`font-semibold text-xs ${sel ? "text-indigo-900" : "text-gray-800"}`}>{label}</div>
              <div className={`text-xs mt-0.5 ${sel ? "text-indigo-700" : "text-gray-400"}`}>{desc}</div>
            </button>
          );
        })}
      </div>

      {tipsType === "REDIRECT" && (
        <div className="space-y-3">
          <Input
            label="URL сервиса чаевых"
            value={tipsUrl}
            onChange={(e) => setTipsUrl(e.target.value)}
            placeholder="https://pay.cloudtips.ru/…"
          />
          <div className="rounded-xl p-4 bg-amber-50 border border-amber-100 text-xs text-amber-900 space-y-1.5">
            <p className="font-semibold">Популярные сервисы чаевых</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><strong>CloudTips</strong> — cloudtips.ru</li>
              <li><strong>ЮMoney</strong> — yoomoney.ru</li>
              <li><strong>Ozon Bank</strong> — раздел «Чаевые» в личном кабинете</li>
            </ul>
          </div>
        </div>
      )}

      {tipsType === "PHONE" && (
        <div className="space-y-3">
          <Input
            label="Номер телефона (СБП)"
            value={tipsPhone}
            onChange={(e) => setTipsPhone(e.target.value)}
            placeholder="+7 900 000-00-00"
          />
          <Input
            label="Рекомендуемый банк (необязательно)"
            value={tipsBankName}
            onChange={(e) => setTipsBankName(e.target.value)}
            placeholder="Тинькофф, Сбербанк, ВТБ…"
          />
          <p className="text-xs text-gray-400">
            Гость увидит номер с кнопкой «Копировать» и откроет приложение банка для перевода.
          </p>
        </div>
      )}

      {tipsType === "EMPLOYEES" && (
        <TipsEmployeesEditor
          establishmentId={establishmentId}
          employees={employees}
          onChange={setEmployees}
        />
      )}

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <Button onClick={handleSave} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Сохранение...
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            Сохранить чаевые
          </>
        )}
      </Button>
    </div>
  );
}

function TipsEmployeesEditor({
  establishmentId,
  employees,
  onChange,
}: {
  establishmentId: string;
  employees: TipsEmployeeItem[];
  onChange: (v: TipsEmployeeItem[]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const addNew = () => {
    onChange([
      ...employees,
      { _localId: Math.random().toString(36).slice(2), name: "", paymentType: "PHONE" },
    ]);
  };

  const remove = async (item: TipsEmployeeItem) => {
    if (item.id) {
      await fetch(`/api/tips-employees?id=${item.id}`, { method: "DELETE" }).catch(() => {});
    }
    onChange(employees.filter((e) => e._localId !== item._localId));
  };

  const update = (localId: string, patch: Partial<TipsEmployeeItem>) => {
    onChange(employees.map((e) => (e._localId === localId ? { ...e, ...patch } : e)));
  };

  const uploadPhoto = async (localId: string, file: File) => {
    update(localId, { uploading: true });
    const item = employees.find((e) => e._localId === localId)!;

    const fd = new FormData();
    fd.append("establishmentId", establishmentId);
    if (item.id) fd.append("id", item.id);
    fd.append("name", item.name || "Сотрудник");
    fd.append("paymentType", item.paymentType);
    if (item.paymentUrl) fd.append("paymentUrl", item.paymentUrl);
    if (item.phone) fd.append("phone", item.phone);
    if (item.bankName) fd.append("bankName", item.bankName);
    fd.append("order", String(employees.findIndex((e) => e._localId === localId)));
    fd.append("photo", file);

    try {
      const res = await fetch("/api/tips-employees", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "Ошибка загрузки");
        return;
      }
      onChange(
        employees.map((e) =>
          e._localId === localId
            ? { ...e, id: d.employee.id, photoUrl: d.employee.photoUrl, uploading: false }
            : e
        )
      );
    } catch {
      setErr("Ошибка загрузки фото");
    } finally {
      update(localId, { uploading: false });
    }
  };

  const saveAll = async () => {
    setSaving(true);
    setErr("");
    try {
      const updated: TipsEmployeeItem[] = [];
      for (let i = 0; i < employees.length; i++) {
        const e = employees[i];
        if (!e.name.trim()) {
          setErr("Укажите имя для каждого сотрудника");
          setSaving(false);
          return;
        }
        const fd = new FormData();
        fd.append("establishmentId", establishmentId);
        if (e.id) fd.append("id", e.id);
        fd.append("name", e.name.trim());
        fd.append("paymentType", e.paymentType);
        if (e.paymentUrl) fd.append("paymentUrl", e.paymentUrl);
        if (e.phone) fd.append("phone", e.phone);
        if (e.bankName) fd.append("bankName", e.bankName);
        fd.append("order", String(i));
        const res = await fetch("/api/tips-employees", { method: "POST", body: fd });
        const d = await res.json();
        if (!res.ok) {
          setErr(d.error || "Ошибка");
          setSaving(false);
          return;
        }
        updated.push({ ...e, id: d.employee.id });
      }
      onChange(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {employees.map((emp, idx) => (
        <div key={emp._localId} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="shrink-0 cursor-pointer relative">
              {emp.photoUrl ? (
                <img src={emp.photoUrl} alt={emp.name} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-lg font-bold">
                  {emp.name ? emp.name.charAt(0).toUpperCase() : "?"}
                </div>
              )}
              {emp.uploading && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) uploadPhoto(emp._localId, f);
                }}
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                <Upload className="w-2.5 h-2.5 text-white" />
              </div>
            </label>

            <input
              value={emp.name}
              onChange={(ev) => update(emp._localId, { name: ev.target.value })}
              placeholder={`Сотрудник ${idx + 1}`}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <button type="button" onClick={() => remove(emp)} className="text-gray-400 hover:text-red-500">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["PHONE", "LINK"] as const).map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() => update(emp._localId, { paymentType: pt })}
                className={`text-xs p-2 rounded-lg border-2 transition-all ${
                  emp.paymentType === pt
                    ? "border-indigo-500 bg-indigo-50 text-indigo-800 font-semibold"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {pt === "PHONE" ? "📱 Номер телефона" : "🔗 Платёжная ссылка"}
              </button>
            ))}
          </div>

          {emp.paymentType === "PHONE" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                value={emp.phone || ""}
                onChange={(ev) => update(emp._localId, { phone: ev.target.value })}
                placeholder="+7 900 000-00-00"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                value={emp.bankName || ""}
                onChange={(ev) => update(emp._localId, { bankName: ev.target.value })}
                placeholder="Банк (Тинькофф…)"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {emp.paymentType === "LINK" && (
            <input
              value={emp.paymentUrl || ""}
              onChange={(ev) => update(emp._localId, { paymentUrl: ev.target.value })}
              placeholder="https://pay.cloudtips.ru/…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
        </div>
      ))}

      {err && <p className="text-xs text-red-600">{err}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addNew}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <span className="text-lg leading-none">+</span> Добавить сотрудника
        </button>
        {employees.length > 0 && (
          <Button size="sm" onClick={saveAll} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Save className="w-3 h-3 mr-1" />
                Сохранить список
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
