import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Отзыв",
  other: {
    referrer: "no-referrer",
  },
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
