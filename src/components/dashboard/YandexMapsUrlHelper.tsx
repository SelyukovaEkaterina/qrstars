import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface YandexMapsUrlHelperProps {
  defaultOpen?: boolean;
  searchName?: string;
}

export default function YandexMapsUrlHelper({
  defaultOpen = false,
  searchName = "",
}: YandexMapsUrlHelperProps) {
  const [open, setOpen] = useState(defaultOpen);
  const query = searchName.trim();
  const searchHref = query
    ? `https://yandex.ru/maps/?text=${encodeURIComponent(query)}`
    : "https://yandex.ru/maps/";

  return (
    <details
      className="mt-2 group"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 [&::-webkit-details-marker]:hidden">
        <HelpCircle className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
        <span>Как скопировать ссылку?</span>
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 transition group-open:rotate-180" />
      </summary>
      <ol className="mt-2 space-y-1.5 pl-5 text-xs leading-relaxed text-gray-500 list-decimal">
        <li>
          Откройте{" "}
          <a
            href={searchHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-600 hover:text-indigo-800"
          >
            поиск Яндекс.Карт
            {query ? ` по «${query}»` : ""}
          </a>{" "}
          и найдите своё заведение.
        </li>
        <li>Откройте карточку организации.</li>
        <li>Нажмите «Поделиться» → «Скопировать ссылку» и вставьте сюда.</li>
      </ol>
    </details>
  );
}
