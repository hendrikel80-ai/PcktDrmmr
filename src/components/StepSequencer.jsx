import { INSTRUMENTS, STEPS_PER_BAR } from '../data/instruments';
import StepCell, { nextVelocity } from './StepCell';

// Two reused glyphs instead of per-instrument images — drum-shell outline
// for membranophones, a flat disc for cymbals/hihats (see iconType in
// instruments.js).
function InstrumentIcon({ type }) {
  if (type === 'cymbal') {
    return (
      <svg viewBox="0 0 24 24" className="sequencer__row-icon-svg" aria-hidden="true">
        <ellipse cx="12" cy="12" rx="9" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <ellipse cx="12" cy="12" rx="3" ry="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="sequencer__row-icon-svg" aria-hidden="true">
      <ellipse cx="12" cy="7" rx="8" ry="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 7v8c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V7" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

// One number per beat (every 4 steps of our fixed 16th-note grid),
// restarting at 1 each bar — reuses the row/label/steps classes so it
// lines up pixel-for-pixel with the step grid below it.
function BeatRuler({ bars }) {
  const totalSteps = bars * STEPS_PER_BAR;
  return (
    <div className="sequencer__row sequencer__ruler">
      <div className="sequencer__label" />
      <div className="sequencer__steps">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} className="sequencer__tick">
            {i % 4 === 0 ? (i % STEPS_PER_BAR) / 4 + 1 : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StepSequencer({ pattern, currentStep, onChange }) {
  const totalSteps = pattern.bars * STEPS_PER_BAR;

  function handleStepClick(instrumentKey, stepIndex) {
    const steps = pattern.pattern[instrumentKey] ?? new Array(totalSteps).fill(0);
    const updatedSteps = steps.slice();
    updatedSteps[stepIndex] = nextVelocity(updatedSteps[stepIndex] ?? 0);
    onChange({
      ...pattern,
      pattern: {
        ...pattern.pattern,
        [instrumentKey]: updatedSteps,
      },
    });
  }

  return (
    <div className="sequencer">
      <BeatRuler bars={pattern.bars} />
      {INSTRUMENTS.map(({ key, label, iconType }) => {
        const steps = pattern.pattern[key] ?? new Array(totalSteps).fill(0);
        return (
          <div className="sequencer__row" key={key}>
            <div className="sequencer__label">
              <InstrumentIcon type={iconType} />
              <span>{label}</span>
            </div>
            <div className="sequencer__steps">
              {steps.map((velocity, stepIndex) => (
                <StepCell
                  key={stepIndex}
                  velocity={velocity}
                  isCurrent={stepIndex === currentStep}
                  isBeatStart={stepIndex % 4 === 0}
                  onClick={() => handleStepClick(key, stepIndex)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
