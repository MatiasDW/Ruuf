import type { UnplacedItem } from "./types";

interface UnplacedSuggestionsProps {
  unplaced: UnplacedItem[];
  onReplace: (oldName: string, newPlantId: string) => void;
  onRemove: (name: string) => void;
}

export function UnplacedSuggestions({ unplaced, onReplace, onRemove }: UnplacedSuggestionsProps) {
  if (unplaced.length === 0) return null;

  return (
    <div className="unplaced-section">
      <div className="section-header">
        <span className="material-symbols-outlined warning-icon">warning</span>
        <h3>Ajustes Sugeridos</h3>
      </div>

      <div className="unplaced-list">
        {unplaced.map((item) => {
          const suggestion = item.suggestions[0];
          return (
            <div key={item.name} className="unplaced-card">
              <div className="unplaced-info">
                <p className="unplaced-name">{item.name}</p>
                <p className="unplaced-reason">{item.reason}</p>
                {suggestion && <p className="unplaced-suggestion">Sugerencia: {suggestion}</p>}
              </div>
              <div className="unplaced-actions">
                {suggestion && (
                  <button
                    type="button"
                    className="action-button replace"
                    onClick={() => onReplace(item.name, suggestion)}
                  >
                    Reemplazar por {suggestion}
                  </button>
                )}
                <button
                  type="button"
                  className="action-button remove"
                  onClick={() => onRemove(item.name)}
                >
                  Quitar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
