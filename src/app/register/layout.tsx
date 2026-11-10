import type { Metadata } from "next";
import IncidentBanner from "@/components/IncidentBanner";

export const metadata: Metadata = {
  title: "Регистрация — QrStars",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <IncidentBanner restoreHref="/restore" />
      {children}
    </>
  );
}
