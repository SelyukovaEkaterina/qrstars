"use client";

import { SessionProvider } from "next-auth/react";
import { type ReactNode } from "react";
import MetrikaUserLinker from "@/components/MetrikaUserLinker";

export default function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <MetrikaUserLinker />
      {children}
    </SessionProvider>
  );
}
