import Constants from "expo-constants";

const API_BASE_URL =
  (Constants.expoConfig?.extra as { API_BASE_URL?: string } | undefined)?.API_BASE_URL ??
  "https://app.qrstars.ru";

export interface ApiQrCode {
  id: string;
  code: string;
  label: string | null;
  mode: string;
  redirectUrl: string | null;
  isActive: boolean;
  scansCount: number;
  centerText: string | null;
  centerLogoUrl: string | null;
  createdAt: string;
  establishment?: { name: string } | null;
}

export interface LoginResult {
  token: string;
  user: { id: string; email: string; name: string | null; role: string };
}

function getToken(): string | null {
  // Lazy import to avoid circular dependency
  const store = require("@/store/auth").useAuthStore as {
    getState: () => { token: string | null };
  };
  return store.getState().token;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    const { useAuthStore } = require("@/store/auth");
    await useAuthStore.getState().logout();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      errorMsg = body.error || errorMsg;
    } catch {
      // non-JSON error
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  return apiFetch<LoginResult>("/api/auth/mobile-login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchMyQrCodes(): Promise<{ qrcodes: ApiQrCode[]; isPro: boolean }> {
  return apiFetch("/api/qrcodes");
}

export async function createDynamicQr(data: {
  label?: string;
  redirectUrl?: string;
  mode?: string;
}): Promise<{ qrcode: ApiQrCode }> {
  return apiFetch("/api/qrcodes", {
    method: "POST",
    body: JSON.stringify({ mode: "REDIRECT", ...data }),
  });
}

export async function updateQrCode(
  id: string,
  data: Partial<Pick<ApiQrCode, "label" | "redirectUrl" | "isActive">>,
): Promise<{ qrcode: ApiQrCode }> {
  return apiFetch("/api/qrcodes", {
    method: "PUT",
    body: JSON.stringify({ id, ...data }),
  });
}

export { API_BASE_URL };
