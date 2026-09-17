import { KITS } from '../data/kits';

// Nur "Acoustic (real)" (pearl-acoustic, ohnehin schon DEFAULT_KIT_ID in
// data/kits.js) wird angezeigt — die anderen Kits bleiben in KITS definiert
// (falls später wieder gebraucht), sind hier aber auf Nutzerwunsch
// ausgeblendet.
const VISIBLE_KIT_IDS = new Set(['pearl-acoustic']);

export default function KitSelector({ kitId, isLoading, onSelect }) {
  const visibleKits = KITS.filter((kit) => VISIBLE_KIT_IDS.has(kit.id));
  return (
    <div className="kit-selector">
      <div className="kit-selector__options">
        {visibleKits.map((kit) => (
          <button
            key={kit.id}
            type="button"
            className={[
              'kit-selector__option',
              kit.id === kitId ? 'kit-selector__option--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={kit.description}
            onClick={() => onSelect(kit.id)}
            disabled={isLoading && kit.id !== kitId}
          >
            {kit.name}
          </button>
        ))}
      </div>
      {isLoading && <span className="kit-selector__status">loading…</span>}
    </div>
  );
}
