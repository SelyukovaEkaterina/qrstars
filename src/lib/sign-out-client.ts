"use client";

import { signOut } from "next-auth/react";

/** Выход без серверного редиректа через NEXTAUTH_URL (иначе на проде уходит на localhost). */
export async function signOutTo(path: string): Promise<void> {
  await signOut({ redirect: false });
  window.location.href = path;
}
