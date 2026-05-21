"use client";

import { useState } from "react";

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
}

export default function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

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
          {value || "📌"}
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

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 top-full mt-2 left-0 w-80 max-h-80 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-xl p-3">
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.label} className="mb-3 last:mb-0">
                <p className="text-xs font-medium text-gray-400 mb-1.5">{cat.label}</p>
                <div className="grid grid-cols-10 gap-0.5">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
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
      )}
    </div>
  );
}
