"use client";

import { getLandingTheme, isDarkLandingTheme } from "@/lib/landing-themes";

interface CustomPageViewProps {
  title: string;
  content: string;
  embedded?: boolean;
  landingTheme?: string | null;
}

export default function CustomPageView({
  title,
  content,
  embedded,
  landingTheme: themeId,
}: CustomPageViewProps) {
  const theme = getLandingTheme(themeId);
  const dark = isDarkLandingTheme(themeId);

  return (
    <div className={embedded ? "p-4" : "px-4 pt-6 pb-10 max-w-2xl mx-auto"}>
      <h1
        className={`font-bold mb-6 ${
          embedded ? "text-lg" : "text-2xl"
        } ${dark ? "text-white" : "text-gray-900"}`}
      >
        {title}
      </h1>
      <div
        className={`prose prose-sm max-w-none ${
          dark ? "text-slate-300 prose-headings:text-white prose-a:text-indigo-400 prose-strong:text-slate-200 prose-li:text-slate-300" : "text-gray-700"
        } ${embedded ? "prose-sm" : ""}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
