import type { LandscapeStyle } from "./types";

interface StyleCardProps {
  style: LandscapeStyle;
  label: string;
  isSelected: boolean;
  onChange: (style: LandscapeStyle) => void;
}

export function StyleCard({ style, label, isSelected, onChange }: StyleCardProps) {
  const backgrounds: Record<LandscapeStyle, string> = {
    mediterranean: "linear-gradient(135deg, #D4A574 0%, #8B6F47 100%)",
    native: "linear-gradient(135deg, #7CB342 0%, #558B2F 100%)",
    formal: "linear-gradient(135deg, #90A4AE 0%, #546E7A 100%)",
    lush: "linear-gradient(135deg, #66BB6A 0%, #43A047 100%)",
  };

  return (
    <button
      type="button"
      onClick={() => onChange(style)}
      className={`style-card ${isSelected ? "selected" : ""}`}
      style={{ backgroundImage: backgrounds[style] }}
    >
      <div className="style-card-content">
        <div className="style-card-check">
          {isSelected && <span className="material-symbols-outlined">check_circle</span>}
        </div>
        <p className="style-card-label">{label}</p>
      </div>
    </button>
  );
}
