// Klick-Zyklus für Velocity: Aus -> Ghost -> Normal -> Akzent -> Aus.
export const VELOCITY_STEPS = [0, 40, 95, 125];

export function nextVelocity(current) {
  const idx = VELOCITY_STEPS.indexOf(current);
  if (idx === -1) return VELOCITY_STEPS[1];
  return VELOCITY_STEPS[(idx + 1) % VELOCITY_STEPS.length];
}

export default function StepCell({ velocity, isCurrent, isBeatStart, onClick }) {
  const intensity = velocity / 127;
  return (
    <button
      type="button"
      className={[
        'step-cell',
        velocity > 0 ? 'step-cell--active' : '',
        isCurrent ? 'step-cell--current' : '',
        isBeatStart ? 'step-cell--beat-start' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={velocity > 0 ? { '--intensity': intensity } : undefined}
      onClick={onClick}
      aria-label={`Velocity ${velocity}`}
    />
  );
}
