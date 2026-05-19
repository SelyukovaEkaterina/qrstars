"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
          <p className="text-sm text-gray-500">
            Нет аккаунта?{" "}
            <a href="/register" className="text-indigo-600 hover:text-indigo-800 font-medium">
              Зарегистрироваться
            </a>
          </p>
          <p className="text-xs text-gray-400">
            Или активируйте табличку, отсканировав QR-код
          </p>
        </div>
      </form>
    </div>
  );
}
