"use client";

interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  policyUrl: string;
  isBg?: boolean;
  dark?: boolean;
}

export default function ConsentCheckbox({ checked, onChange, policyUrl, isBg, dark }: ConsentCheckboxProps) {
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

  return (
    <label className={`flex items-start gap-2 cursor-pointer text-xs leading-snug ${textClass}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded accent-indigo-600 flex-shrink-0"
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
      </span>
    </label>
  );
}
