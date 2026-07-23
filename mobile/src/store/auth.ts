import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "qrstars_mobile_token";
const USER_KEY = "qrstars_mobile_user";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: false,
  isAuthenticated: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { loginUser } = await import("@/api/client");
      const result = await loginUser(email, password);
      await secureSet(TOKEN_KEY, result.token);
      await secureSet(USER_KEY, JSON.stringify(result.user));
      set({ token: result.token, user: result.user, isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    await secureDelete(TOKEN_KEY);
    await secureDelete(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },

  hydrate: async () => {
    const token = await secureGet(TOKEN_KEY);
    const userStr = await secureGet(USER_KEY);
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as AuthUser;
        set({ token, user, isAuthenticated: true });
      } catch {
        await secureDelete(TOKEN_KEY);
        await secureDelete(USER_KEY);
      }
    }
  },
}));
