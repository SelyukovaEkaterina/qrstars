"use client";

import { forwardRef } from "react";

interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  policyUrl: string;
  isBg?: boolean;
  dark?: boolean;
  /** Гость нажал «Отправить» без галочки — подсвечиваем чекбокс. */
  highlight?: boolean;
}

const ConsentCheckbox = forwardRef<HTMLLabelElement, ConsentCheckboxProps>(
  function ConsentCheckbox({ checked, onChange, policyUrl, isBg, dark, highlight }, ref) {
    const textClass = isBg
      ? "text-white/70"
      : dark
        ? "text-slate-400"
        : "text-gray-500";
    const linkClass = isBg
      ? "text-white underline"
      : dark
        ? "text-indigo-400 underline"
        : "text-indigo-600 underline";
    const highlightClass = highlight
      ? isBg || dark
        ? "ring-2 ring-rose-400 bg-rose-400/10"
        : "ring-2 ring-red-400 bg-red-50"
      : "";
    const hintClass = isBg || dark ? "text-rose-300" : "text-red-600";

    return (
      <label
        ref={ref}
        className={`flex items-start gap-2 cursor-pointer text-xs leading-snug rounded-lg p-2 -m-2 transition-colors scroll-mt-24 ${textClass} ${highlightClass}`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-5 h-5 rounded accent-indigo-600 flex-shrink-0"
        />
        <span>
          Даю согласие на{" "}
          <a
            href={policyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
            onClick={(e) => e.stopPropagation()}
          >
            обработку персональных данных
          </a>
          {highlight && (
            <span className={`block mt-1 font-medium ${hintClass}`}>
              Отметьте согласие, чтобы отправить
            </span>
          )}
        </span>
      </label>
    );
  }
);

export default ConsentCheckbox;
