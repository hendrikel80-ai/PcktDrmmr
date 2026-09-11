import { KITS } from '../data/kits';

export default function KitSelector({ kitId, isLoading, onSelect }) {
  return (
    <div className="kit-selector">
      <div className="kit-selector__options">
        {KITS.map((kit) => (
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
