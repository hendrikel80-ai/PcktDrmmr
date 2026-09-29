import { VIEW_MODES } from '../utils/viewMode';

// Switches between Jam (simple: no Build a Song section) and Songwriting
// (everything, including Build a Song) — see App.jsx/MobileApp.jsx for the
// actual show/hide. Reuses KitSelector's pill-button styling on purpose
// (same "kit-selector__option" classes) so it reads as the same kind of
// control, per the user's own request.
export default function ViewModeToggle({ mode, onChange }) {
  return (
    <div className="kit-selector__options view-mode-toggle">
      <button
        type="button"
        className={[
          'kit-selector__option',
          mode === VIEW_MODES.JAM ? 'kit-selector__option--active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onChange(VIEW_MODES.JAM)}
        title="Simple view for jamming — no song builder"
      >
        Jam
      </button>
      <button
        type="button"
        className={[
          'kit-selector__option',
          mode === VIEW_MODES.SONGWRITING ? 'kit-selector__option--active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onChange(VIEW_MODES.SONGWRITING)}
        title="Full view, including the song builder"
      >
        Songwriting
      </button>
    </div>
  );
}
