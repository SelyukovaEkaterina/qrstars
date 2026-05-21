"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Ошибка");
      setLoading(false);
      return;
    }

    setSuccess(true);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Ссылка недействительна</h1>
          <p className="text-gray-500 text-sm">
            Ссылка для сброса пароля отсутствует или устарела. Запросите новую.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block text-indigo-600 hover:text-indigo-800 font-medium text-sm"
          >
            Запросить ссылку заново
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">QrStars.ru</h1>
          <p className="text-gray-500 mt-2">Новый пароль</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
              Пароль успешно изменён!
            </div>
            <Link
              href="/login"
              className="block text-center text-indigo-600 hover:text-indigo-800 font-medium text-sm"
            >
              Войти с новым паролем
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <Input
              id="password"
              label="Новый пароль"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
            />

            <Input
              id="confirmPassword"
              label="Подтвердите пароль"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
            />

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Сохраняем..." : "Сменить пароль"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
