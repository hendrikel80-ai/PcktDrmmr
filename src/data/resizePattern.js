import { INSTRUMENTS, STEPS_PER_BAR } from './instruments';

// Extends or trims every instrument's step array to match a new bar count
// — pads with 0 (off) when growing, drops from the end when shrinking.
// Iterates INSTRUMENTS rather than Object.keys(pattern.pattern) so an
// instrument the pattern never touched (still falling back to an all-zero
// array at render time, see StepSequencer.jsx) ends up with a real,
// correctly-sized array too, not just the ones already present.
export function resizePatternBars(pattern, newBars) {
  const newTotalSteps = newBars * STEPS_PER_BAR;
  const newPatternSteps = Object.fromEntries(
    INSTRUMENTS.map(({ key }) => {
      const existing = pattern.pattern[key] ?? [];
      const resized = existing.slice(0, newTotalSteps);
      while (resized.length < newTotalSteps) resized.push(0);
      return [key, resized];
    })
  );
  return { ...pattern, bars: newBars, pattern: newPatternSteps };
}
