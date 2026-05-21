"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Ошибка");
      setLoading(false);
      return;
    }

    setSuccess(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">QrStars.ru</h1>
          <p className="text-gray-500 mt-2">Восстановление пароля</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
              Если аккаунт с таким email существует, мы отправили ссылку для сброса пароля.
            </div>
            <Link
              href="/login"
              className="block text-center text-indigo-600 hover:text-indigo-800 font-medium text-sm"
            >
              Вернуться к входу
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}

            <Input
              id="email"
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@example.com"
            />

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Отправляем..." : "Отправить ссылку"}
            </Button>

            <p className="text-sm text-gray-500 text-center">
              Вспомнили пароль?{" "}
              <Link href="/login" className="text-indigo-600 hover:text-indigo-800 font-medium">
                Войти
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
