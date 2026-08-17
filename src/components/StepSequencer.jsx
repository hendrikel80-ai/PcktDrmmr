import { INSTRUMENTS, STEPS_PER_BAR } from '../data/instruments';
import StepCell, { nextVelocity } from './StepCell';

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
      {INSTRUMENTS.map(({ key, label }) => {
        const steps = pattern.pattern[key] ?? new Array(totalSteps).fill(0);
        return (
          <div className="sequencer__row" key={key}>
            <div className="sequencer__label">{label}</div>
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
