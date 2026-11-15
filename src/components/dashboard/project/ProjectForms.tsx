"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardList,
  ExternalLink,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  BarChart3,
  QrCode,
  Trash2,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormEditor, { type FormEditState } from "@/components/dashboard/FormEditor";
import FormStatsPanel from "@/components/dashboard/project/FormStatsPanel";
import { FORM_PRESETS, type FormFieldType } from "@/lib/form-config";
import { FORM_FREE_MONTHLY_SUBMISSIONS } from "@/lib/plans";
import { projectInboxPath, projectQrPath } from "@/lib/project-routes";
import { scanUrlForCode } from "@/lib/utils";

interface ApiField {
  id: string;
  label: string;
  placeholder: string | null;
  helpText: string | null;
  type: string;
  required: boolean;
  options: unknown;
  order: number;
}

interface ApiForm {
  id: string;
  title: string;
  description: string | null;
  submitLabel: string;
  successMessage: string;
  enabled: boolean;
  preset: string | null;
  fields: ApiField[];
  _count?: { submissions: number };
}

interface ApiQr {
  id: string;
  code: string;
  label: string | null;
  mode: string;
  formId?: string | null;
}

interface Quota {
  unlimited: boolean;
  limit: number;
  used: number;
  locked: number;
}

function toEditState(f: ApiForm): FormEditState {
  return {
    id: f.id,
    title: f.title,
    description: f.description,
    submitLabel: f.submitLabel,
    successMessage: f.successMessage,
    enabled: f.enabled,
    fields: f.fields.map((x) => ({
      id: x.id,
      label: x.label,
      placeholder: x.placeholder,
      helpText: x.helpText,
      type: x.type as FormFieldType,
      required: x.required,
      options: Array.isArray(x.options) ? (x.options as string[]) : null,
      order: x.order,
    })),
  };
}

export default function ProjectForms({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [forms, setForms] = useState<ApiForm[]>([]);
  const [qrcodes, setQrcodes] = useState<ApiQr[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(() => searchParams.get("form"));
  const [statsId, setStatsId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [formsRes, qrRes, quotaRes] = await Promise.all([
      fetch(`/api/forms?establishmentId=${projectId}`).then((r) => r.json()),
      fetch(`/api/qrcodes?establishmentId=${projectId}`).then((r) => r.json()),
      fetch(`/api/establishments/${projectId}/form-submissions?limit=1`).then((r) => r.json()),
    ]);
    setForms(formsRes.forms ?? []);
    setQrcodes((qrRes.qrcodes ?? []).filter((q: ApiQr) => q.mode === "FORM" && q.formId));
    setQuota(quotaRes.quota ?? null);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) setError("Не удалось загрузить формы");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const createForm = async (presetId: string) => {
    setBusy(`create:${presetId}`);
    setError("");
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ establishmentId: projectId, presetId, enabled: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось создать форму");
      setPickerOpen(false);
      await load();
      setEditingId(data.form.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать форму");
    } finally {
      setBusy(null);
    }
  };

  const createQr = async (form: ApiForm) => {
    setBusy(`qr:${form.id}`);
    setError("");
    try {
      const res = await fetch("/api/qrcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ establishmentId: projectId, mode: "FORM", formId: form.id, label: form.title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось создать QR-код");
      router.push(`${projectQrPath(projectId, data.qrcode.id)}?welcome=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать QR-код");
      setBusy(null);
    }
  };

  const deleteForm = async (form: ApiForm) => {
    const linked = qrcodes.filter((q) => q.formId === form.id).length;
    const warning = linked
      ? `Форма «${form.title}» привязана к ${linked} QR. После удаления они покажут «Форма не настроена». Ответы тоже удалятся. Удалить?`
      : `Удалить форму «${form.title}» вместе с ответами?`;
    if (!window.confirm(warning)) return;
    setBusy(`delete:${form.id}`);
    await fetch(`/api/forms?id=${form.id}`, { method: "DELETE" });
    if (editingId === form.id) setEditingId(null);
    await load();
    setBusy(null);
  };

  const saveForm = async (patch: Partial<FormEditState>) => {
    if (!editingId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/forms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить");
      setForms((prev) => prev.map((f) => (f.id === editingId ? { ...f, ...data.form } : f)));
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const editing = forms.find((f) => f.id === editingId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Формы и анкеты</h1>
          <p className="mt-1 text-gray-500">
            Опросы, запись, регистрация, участие в акции. Гость сканирует QR и заполняет форму на телефоне.
          </p>
        </div>
        <Button onClick={() => setPickerOpen((v) => !v)}>
          {pickerOpen ? <X className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
          {pickerOpen ? "Закрыть" : "Новая форма"}
        </Button>
      </div>

      {quota && !quota.unlimited && (
        <p className="text-sm text-gray-500" data-upsell="forms-page-quota">
          Ответов в этом месяце: {Math.min(quota.used, quota.limit)} из {FORM_FREE_MONTHLY_SUBMISSIONS} на FREE
          {quota.locked > 0 && <span className="text-amber-700"> · ещё {quota.locked} скрыто</span>}.{" "}
          <Link href="/dashboard/subscription" className="font-medium text-indigo-600 hover:underline">
            Без лимита и с выгрузкой в CSV — на PRO
          </Link>
        </p>
      )}

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {(pickerOpen || forms.length === 0) && (
        <Card>
          <h2 className="mb-1 font-semibold text-gray-900">Выберите шаблон</h2>
          <p className="mb-4 text-sm text-gray-500">Вопросы и варианты ответа поменяете после создания.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FORM_PRESETS.map((p) => (
              <div key={p.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-xl leading-none" aria-hidden>
                    {p.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs leading-snug text-gray-500">{p.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" onClick={() => void createForm(p.id)} disabled={busy !== null}>
                    {busy === `create:${p.id}` ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Создать
                  </Button>
                  {p.id !== "blank" && (
                    <a
                      href={`/q/demo-form?t=${p.id}`}
                      target="_blank"
                      rel="noopener"
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Пример
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {forms.length > 0 && (
        <div className="space-y-3">
          {forms.map((f) => {
            const linkedQrs = qrcodes.filter((q) => q.formId === f.id);
            const isEditing = f.id === editingId;
            const showStats = f.id === statsId;
            return (
              <Card key={f.id} className={isEditing ? "ring-2 ring-indigo-200" : undefined}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-violet-600" />
                      <h3 className="font-semibold text-gray-900">{f.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          f.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {f.enabled ? "Принимает ответы" : "Выключена"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {f.fields.length} {f.fields.length === 1 ? "вопрос" : "вопросов"} · ответов:{" "}
                      {f._count?.submissions ?? 0}
                      {linkedQrs.length > 0 && (
                        <>
                          {" "}
                          · QR:{" "}
                          {linkedQrs.map((q, i) => (
                            <span key={q.id}>
                              {i > 0 && ", "}
                              <Link href={projectQrPath(projectId, q.id)} className="text-indigo-600 hover:underline">
                                {q.label || q.code}
                              </Link>
                            </span>
                          ))}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStatsId(showStats ? null : f.id)}>
                      <BarChart3 className="mr-1 h-4 w-4" />
                      {showStats ? "Скрыть сводку" : "Сводка"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingId(isEditing ? null : f.id)}>
                      <Pencil className="mr-1 h-4 w-4" />
                      {isEditing ? "Свернуть" : "Вопросы"}
                    </Button>
                    {linkedQrs.length === 0 ? (
                      <Button size="sm" onClick={() => void createQr(f)} disabled={busy !== null}>
                        {busy === `qr:${f.id}` ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <QrCode className="mr-1 h-4 w-4" />
                        )}
                        Создать QR
                      </Button>
                    ) : (
                      <a
                        href={scanUrlForCode(linkedQrs[0].code)}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Как видит гость
                      </a>
                    )}
                    <Link
                      href={projectInboxPath(projectId, "submissions")}
                      className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Inbox className="mr-1 h-4 w-4" />
                      Ответы
                    </Link>
                    <button
                      type="button"
                      onClick={() => void deleteForm(f)}
                      disabled={busy !== null}
                      className="inline-flex h-9 items-center rounded-lg px-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Удалить форму"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {showStats && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <FormStatsPanel formId={f.id} />
                  </div>
                )}

                {isEditing && editing && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <FormEditor key={editing.id} initialData={toEditState(editing)} saving={saving} onSave={saveForm} />
                    {savedAt && !saving && <p className="mt-2 text-right text-xs text-green-700">Сохранено</p>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
