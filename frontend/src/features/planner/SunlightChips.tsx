import type { Sunlight } from "./types";

interface SunlightChipsProps {
  value: Sunlight;
  onChange: (value: Sunlight) => void;
}

const SUNLIGHT_OPTIONS: Array<{ value: Sunlight; label: string; icon: string }> = [
  { value: "full_sun", label: "Pleno sol", icon: "light_mode" },
  { value: "partial_shade", label: "Media sombra", icon: "cloud" },
  { value: "shade", label: "Sombra", icon: "dark_mode" },
];

export function SunlightChips({ value, onChange }: SunlightChipsProps) {
  return (
    <div className="flex flex-wrap gap-sm">
      {SUNLIGHT_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-4 py-2 rounded-full border font-label-md text-label-md flex items-center gap-1 transition-colors ${
            value === option.value
              ? "border-primary bg-primary-container/10 text-primary"
              : "border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">{option.icon}</span>
          {option.label}
        </button>
      ))}
    </div>
  );
}
