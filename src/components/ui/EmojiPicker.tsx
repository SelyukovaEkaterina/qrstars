"use client";

import { useEffect, useState, type ReactNode } from "react";

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Общее",
    emojis: ["📋", "📄", "📝", "✏️", "💡", "🔔", "🎁", "🏷️", "💬", "📞", "📌", "📎", "🎯", "📊", "📈", "🗂️", "📰", "📢", "🔍", "⚙️"],
  },
  {
    label: "Бизнес",
    emojis: ["🏢", "🏪", "🏠", "📍", "🗺️", "ℹ️", "❓", "💼", "💳", "🤝", "📦", "🚚", "🛒", "🛍️", "💰", "💵", "🏦", "📧"],
  },
  {
    label: "Еда и напитки",
    emojis: ["☕", "🍽️", "🍕", "🍔", "🍣", "🍩", "🍰", "🥤", "🍺", "🍷", "🥐", "🥗", "🍜", "🧁", "🍪", "🫕", "🥩", "🍗"],
  },
  {
    label: "Авто и транспорт",
    emojis: ["🚗", "🚙", "🔧", "⛽", "🛞", "🅿️", "🚕", "🚌", "🚎", "🛵", "🏍️", "🚲", "✈️", "🚂", "🚢"],
  },
  {
    label: "Здоровье",
    emojis: ["🏥", "🦷", "💊", "❤️", "🩺", "🧬", "🩹", "🧘", "💪", "🫀", "🦴", "👁️", "🧠"],
  },
  {
    label: "Красота",
    emojis: ["💅", "💇", "💄", "✨", "🧴", "🪮", "💆", "🌸", "💎", "👑", "🪷", "🧖"],
  },
  {
    label: "Люди",
    emojis: ["👤", "👥", "👨‍🍳", "👩‍⚕️", "👷", "🧑‍💼", "🧑‍🔧", "👨‍🏫", "🧑‍🎓", "🧔", "👴", "👵", "🧒", "👶"],
  },
  {
    label: "Связь и соцсети",
    emojis: ["🌐", "🔗", "📱", "💻", "📲", "📸", "🎥", "🎵", "🎤", "🎧", "📺", "📡"],
  },
  {
    label: "Время",
    emojis: ["🕐", "⏰", "📅", "🗓️", "⏳", "📆", "🕒", "🕠", "🕛"],
  },
  {
    label: "Природа и отдых",
    emojis: ["🌿", "🌸", "🌳", "🌺", "☀️", "🌤️", "🌊", "🏖️", "⛰️", "🏕️", "🎣", "🎮", "🏋️", "⚽", "🏀", "🎾", "⛷️"],
  },
  {
    label: "Награды",
    emojis: ["⭐", "🏆", "🎖️", "🥇", "🥈", "🥉", "🏅", "💯", "🔥", "🚀", "🎉", "🎊", "❤️‍🔥"],
  },
];

interface EmojiPickerProps {
  value: string | null | undefined;
  onChange: (emoji: string | null) => void;
  inline?: boolean;
  /** Что показать в кнопке-триггере, если значение пустое (например, Lucide-иконка по умолчанию). */
  fallback?: ReactNode;
}

export default function EmojiPicker({ value, onChange, inline, fallback }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [textInput, setTextInput] = useState<string>(value ?? "");

  // Sync local text input when external value changes or dropdown opens
  useEffect(() => {
    setTextInput(value ?? "");
  }, [value, open]);

  const commitText = () => {
    const v = textInput.trim();
    if (v !== (value ?? "")) {
      onChange(v || null);
    }
  };

  const triggerContent = value || fallback || "📌";

  const dropdown = open ? (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => {
          commitText();
          setOpen(false);
        }}
      />
      <div className="absolute z-50 top-full mt-1 left-0 w-80 max-h-96 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-xl p-3">
        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitText();
                setOpen(false);
              }
              if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Свой символ или текст"
            maxLength={24}
            className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          {(value || textInput) && (
            <button
              type="button"
              onClick={() => {
                setTextInput("");
                onChange(null);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              title="Сбросить к иконке по умолчанию"
            >
              Сбросить
            </button>
          )}
        </div>
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.label} className="mb-3 last:mb-0">
            <p className="text-xs font-medium text-gray-400 mb-1.5">{cat.label}</p>
            <div className="grid grid-cols-10 gap-0.5">
              {cat.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setTextInput(emoji);
                    onChange(emoji);
                    setOpen(false);
                  }}
                  className={`w-7 h-7 rounded flex items-center justify-center text-base hover:bg-indigo-50 transition-colors ${
                    value === emoji ? "bg-indigo-100 ring-1 ring-indigo-300" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  ) : null;

  if (inline) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-7 h-7 rounded flex items-center justify-center text-sm transition-colors ${
            open
              ? "bg-indigo-100 border border-indigo-300"
              : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
          }`}
          title="Выбрать иконку"
        >
          {triggerContent}
        </button>
        {dropdown}
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Иконка
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg transition-colors ${
            open
              ? "border-indigo-400 bg-indigo-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          {triggerContent}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Сбросить
          </button>
        )}
      </div>

      {dropdown}
    </div>
  );
}
