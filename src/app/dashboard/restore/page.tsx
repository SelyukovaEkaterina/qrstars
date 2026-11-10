"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, LifeBuoy } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { BEGET_INCIDENT, PENDING_RESTORE_CODE_KEY } from "@/lib/incident";
import { parseRestoreCode } from "@/lib/qr-restore";
import { projectQrPath } from "@/lib/project-routes";

interface Project {
  id: string;
  name: string;
}

interface Restored {
  id: string;
  code: string;
  establishmentId: string;
  redirectUrl: string | null;
}

const NEW_PROJECT = "__new__";

function RestoreQrForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [canAddProject, setCanAddProject] = useState(true);
  const [projectId, setProjectId] = useState(NEW_PROJECT);
  const [projectName, setProjectName] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingHref, setExistingHref] = useState<string | null>(null);
  const [restored, setRestored] = useState<Restored | null>(null);

  useEffect(() => {
    fetch("/api/establishments")
      .then((r) => r.json())
      .then((data) => {
        const list: Project[] = (data.establishments || []).map((e: Project) => ({ id: e.id, name: e.name }));
        setProjects(list);
        if (list.length > 0) setProjectId(list[0].id);
      })
      .catch(() => setProjects([]));
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.canAddEstablishment === "boolean") setCanAddProject(data.canAddEstablishment);
      })
      .catch(() => {});
  }, []);

  const hasProjects = (projects?.length ?? 0) > 0;
  const creatingProject = !hasProjects || projectId === NEW_PROJECT;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setExistingHref(null);
    const parsed = parseRestoreCode(code);
    if (!parsed) {
      setError("Не похоже на ID QR-кода. Скопируйте его со страницы, которая открывается при сканировании, или вставьте ссылку из QR целиком.");
      return;
    }
    if (creatingProject && !projectName.trim()) {
      setError("Введите название проекта");
      return;
    }

    setLoading(true);
    try {
      let establishmentId = projectId;
      if (creatingProject) {
        const res = await fetch("/api/establishments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: projectName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Не удалось создать проект");
          return;
        }
        establishmentId = data.establishment.id;
        setProjects((prev) => [...(prev ?? []), { id: establishmentId, name: data.establishment.name }]);
        setProjectId(establishmentId);
        setProjectName("");
        window.dispatchEvent(new Event("qrstars:projects-changed"));
      }

      const res = await fetch("/api/qrcodes/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: parsed, establishmentId, redirectUrl: redirectUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось восстановить QR-код");
        if (data.qrcodeId && data.establishmentId) {
          setExistingHref(projectQrPath(data.establishmentId, data.qrcodeId));
        }
        return;
      }
      setRestored(data.qrcode);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  const restoreAnother = () => {
    setRestored(null);
    setCode("");
    setRedirectUrl("");
    setError("");
  };

  return (
    <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <LifeBuoy className="h-6 w-6 text-amber-600" />
            Восстановить QR-код
          </h1>
          <p className="mt-1 text-gray-500">
            {BEGET_INCIDENT.dateLabel} у хостинг-провайдера Beget произошла авария (
            <a href={BEGET_INCIDENT.newsUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              РБК
            </a>
            ), и часть данных утрачена. Напечатанный QR-код можно вернуть: введите его ID и заново укажите, куда он ведёт.
          </p>
        </div>

        {restored ? (
          <Card>
            <div className="space-y-4 py-4 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
              <h2 className="text-xl font-bold text-gray-900">QR-код восстановлен</h2>
              <p className="text-gray-600">
                Код <span className="font-mono">{restored.code}</span> снова в вашем кабинете.{" "}
                {restored.redirectUrl
                  ? "Сканирование уже ведёт на указанную ссылку."
                  : "Пока режим не выбран, гости видят «временно недоступен» — откройте настройки и выберите, что показывать."}
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  className="min-h-11"
                  onClick={() => router.push(`${projectQrPath(restored.establishmentId, restored.id)}#qr-mode`)}
                >
                  {restored.redirectUrl ? "Открыть настройки QR" : "Выбрать, что показывать"}
                </Button>
                <Button variant="outline" className="min-h-11" onClick={restoreAnother}>
                  Восстановить ещё один
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                  {existingHref && (
                    <>
                      {" "}
                      <Link href={existingHref} className="font-medium underline">
                        Открыть
                      </Link>
                    </>
                  )}
                </div>
              )}

              <div>
                <Input
                  id="restore-code"
                  label="ID QR-кода"
                  placeholder="например, ab3k9z или https://app.qrstars.ru/q/ab3k9z"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Отсканируйте свою табличку: на странице «Редирект временно недоступен» указан ID кода. Можно вставить и
                  ссылку из QR целиком.
                </p>
              </div>

              {projects === null ? null : hasProjects ? (
                <div className="space-y-2">
                  <label htmlFor="restore-project" className="block text-sm font-medium text-gray-700">
                    Проект
                  </label>
                  <select
                    id="restore-project"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base sm:text-sm"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    {canAddProject && <option value={NEW_PROJECT}>+ Новый проект</option>}
                  </select>
                  {projectId === NEW_PROJECT && (
                    <Input
                      id="restore-project-name"
                      placeholder="Название заведения или проекта"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  )}
                </div>
              ) : (
                <Input
                  id="restore-project-name"
                  label="Название проекта"
                  placeholder="Название заведения или проекта"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                />
              )}

              <div>
                <Input
                  id="restore-url"
                  label="Куда вёл QR (если это была ссылка)"
                  placeholder="https://…"
                  type="url"
                  inputMode="url"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Необязательно. Если QR открывал отзывы, меню, визитку или Wi-Fi — оставьте пустым и настройте режим
                  после восстановления.
                </p>
              </div>

              <Button type="submit" size="lg" className="min-h-12 w-full" disabled={loading}>
                {loading ? "Восстанавливаем…" : "Восстановить QR"}
              </Button>
            </form>
          </Card>
        )}

        <p className="text-sm text-gray-500">
          Код уже занят чужим аккаунтом или кодов много?{" "}
          <Link href="/dashboard/support" className="text-indigo-600 underline underline-offset-2">
            Напишите в поддержку
          </Link>
          , разберёмся вручную.
        </p>
      </div>
    </main>
  );
}

function RestoreQrEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCode = searchParams.get("code") ?? "";

  useEffect(() => {
    // Код, введённый до регистрации на /restore, — переносим в ссылку, если там пусто.
    const pending = localStorage.getItem(PENDING_RESTORE_CODE_KEY);
    localStorage.removeItem(PENDING_RESTORE_CODE_KEY);
    if (pending && !urlCode) router.replace(`/dashboard/restore?code=${encodeURIComponent(pending)}`);
  }, [router, urlCode]);

  return <RestoreQrForm key={urlCode} initialCode={urlCode} />;
}

export default function RestoreQrPage() {
  return (
    <Suspense fallback={null}>
      <RestoreQrEntry />
    </Suspense>
  );
}
