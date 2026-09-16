"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function AccountSettings() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    fetch("/api/account/password")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        setHasPassword(Boolean(data.hasPassword));
      })
      .catch(() => setHasPassword(false));
  }, []);

  const changePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword.length < 8) {
      setPasswordError("Новый пароль должен содержать не менее 8 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Пароли не совпадают");
      return;
    }

    setPasswordBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Не удалось изменить пароль");
        return;
      }
      setHasPassword(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(
        data.passwordCreated ? "Пароль создан" : "Пароль успешно изменён"
      );
    } catch {
      setPasswordError("Ошибка соединения");
    } finally {
      setPasswordBusy(false);
    }
  };

  const requestDeletion = async () => {
    if (
      !window.confirm(
        "Отправить запрос на удаление аккаунта и связанных данных? Поддержка свяжется с вами для подтверждения."
      )
    ) {
      return;
    }
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account/delete-request", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Не удалось отправить запрос");
        return;
      }
      setDeleteRequested(true);
    } catch {
      setDeleteError("Ошибка соединения");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex items-start gap-3">
          <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold text-gray-900">
              {hasPassword ? "Сменить пароль" : "Создать пароль"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {hasPassword
                ? "После смены используйте новый пароль при следующем входе."
                : "Вы вошли через соцсеть. Создайте пароль, чтобы входить также по email."}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {hasPassword && (
            <Input
              label="Текущий пароль"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          )}
          <Input
            label="Новый пароль"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Повторите новый пароль"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          {passwordSuccess && (
            <p className="text-sm text-green-700">{passwordSuccess}</p>
          )}
          <Button
            type="button"
            size="sm"
            onClick={changePassword}
            disabled={passwordBusy || hasPassword === null}
          >
            {passwordBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {hasPassword ? "Изменить пароль" : "Создать пароль"}
          </Button>
        </div>
      </Card>

      <Card className="border-red-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Удаление аккаунта</h3>
            <p className="mt-1 text-sm text-gray-500">
              Запрос включает удаление персональных данных. Поддержка подтвердит
              состав удаляемых данных и проверит активную подписку.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-red-200 text-red-700 hover:bg-red-50"
            onClick={requestDeletion}
            disabled={deleteBusy || deleteRequested}
          >
            {deleteBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {deleteRequested ? "Запрос отправлен" : "Запросить удаление"}
          </Button>
        </div>
        {deleteError && <p className="mt-3 text-sm text-red-600">{deleteError}</p>}
        {deleteRequested && (
          <p className="mt-3 text-sm text-green-700">
            Запрос отправлен. Ответ появится в разделе «Поддержка».
          </p>
        )}
      </Card>
    </div>
  );
}
