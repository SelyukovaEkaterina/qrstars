"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MessengersPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/settings#notification-channels");
  }, [router]);

  return null;
}
