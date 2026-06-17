"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { resolveMetrikaClientId, getMetrikaClientIdFromSearchParams } from "@/lib/metrika-client-id";
import { parseRegistrationUtmFromSearchParams } from "@/lib/registration-utm";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");
  const establishmentInvite = searchParams.get("establishmentInvite");
  const [invitePreview, setInvitePreview] = useState<{
    establishmentName: string;
    email: string;
    inviterName: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consentPd, setConsentPd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!establishmentInvite) return;
    fetch(`/api/establishments/invite-preview?token=${encodeURIComponent(establishmentInvite)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.email) {
          setInvitePreview(data);
          setEmail(data.email);
        }
      })
      .catch(() => {});
  }, [establishmentInvite]);

  useEffect(() => {
    const fromQuery = getMetrikaClientIdFromSearchParams(searchParams);
    if (fromQuery) sessionStorage.setItem("qrstars_ym_uid", fromQuery);
  }, [searchParams]);

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

    if (!consentPd) {
      setError("Необходимо дать согласие на обработку и передачу персональных данных");
      setLoading(false);
      return;
    }

    const registrationUtm = parseRegistrationUtmFromSearchParams(searchParams);
    const metrikaClientId = resolveMetrikaClientId(searchParams) || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("qrstars_ym_uid") : null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        name,
        phone,
        consentPd: true,
        ref: refCode || undefined,
        establishmentInvite: establishmentInvite || undefined,
        ...(registrationUtm ? { registrationUtm } : {}),
        ...(metrikaClientId ? { metrikaClientId } : {}),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Ошибка регистрации");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email: data.user?.email ?? email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Аккаунт создан, но не удалось войти автоматически");
      setLoading(false);
      return;
    }

    router.push("/dashboard/start");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="max-w-sm w-full space-y-5">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">QrStars.ru</h1>
          <p className="text-gray-500 mt-2">Регистрация — дальше настроите страницу и QR для гостей</p>
        </div>

        {invitePreview && (
          <div className="bg-indigo-50 text-indigo-900 px-4 py-3 rounded-lg text-sm">
            <strong>{invitePreview.inviterName}</strong> приглашает вас в заведение{" "}
            <strong>{invitePreview.establishmentName}</strong>. Зарегистрируйтесь с email{" "}
            <strong>{invitePreview.email}</strong>.
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <Input
          id="name"
          label="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Иван Иванов"
        />

        <Input
          id="email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={!!invitePreview}
          placeholder="owner@example.com"
        />

        <Input
          id="phone"
          label="Телефон"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 (999) 123-45-67"
        />

        <Input
          id="password"
          label="Пароль"
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

        <label className="flex items-start gap-3 cursor-pointer text-sm text-gray-600">
          <input
            type="checkbox"
            checked={consentPd}
            onChange={(e) => setConsentPd(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            required
          />
          <span>
            Принимаю условия{" "}
            <Link
              href="/offer"
              target="_blank"
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              публичной оферты
            </Link>
            {" "}и{" "}
            <a
              href="https://qrstars.ru/politika-konfidencialnosti.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              политики конфиденциальности
            </a>
            .
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
        </Button>

        <p className="text-sm text-gray-500 text-center">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-indigo-600 hover:text-indigo-800 font-medium">
            Войти
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
