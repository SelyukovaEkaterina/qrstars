"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import VkIdLogin from "@/components/auth/VkIdLogin";
import YandexIdLogin from "@/components/auth/YandexIdLogin";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => {
    if (searchParams.get("session") === "expired") {
      return "Сессия устарела. Войдите снова.";
    }
    return searchParams.get("yandex_error") || "";
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Неверный email или пароль");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">QrStars.ru</h1>
          <p className="text-gray-500 mt-2">Вход в личный кабинет</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="mx-auto w-full max-w-[400px] space-y-3">
          <YandexIdLogin />
          <VkIdLogin />
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          <span>или по email</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <Input
          id="email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="owner@example.com"
        />

        <Input
          id="password"
          label="Пароль"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Входим..." : "Войти"}
        </Button>

        <div className="text-center space-y-1">
          <a href="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            Забыли пароль?
          </a>
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm text-gray-500">
            Нет аккаунта?{" "}
            <a
              href={searchParams.toString() ? `/register?${searchParams.toString()}` : "/register"}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Зарегистрироваться
            </a>
          </p>
          <p className="text-xs text-gray-400">
            Без таблички — после регистрации настроите QR за 2 минуты
          </p>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
