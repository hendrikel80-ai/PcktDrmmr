import { useEffect, useRef, useState, useCallback } from 'react';
import { DrumSynth } from './DrumSynth';
import { Scheduler } from './Scheduler';

// Erzeugt AudioContext/DrumSynth/Scheduler lazy beim ersten Play-Klick,
// weil Browser AudioContext ohne vorherige User-Geste blockieren.
export function useAudioEngine(pattern) {
  const engineRef = useRef(null);
  const patternRef = useRef(pattern);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  patternRef.current = pattern;

  const ensureEngine = useCallback(() => {
    if (engineRef.current) return engineRef.current;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const drumSynth = new DrumSynth(audioCtx);
    const scheduler = new Scheduler(audioCtx, drumSynth);
    scheduler.onStep = (step) => setCurrentStep(step);
    engineRef.current = { audioCtx, drumSynth, scheduler };
    return engineRef.current;
  }, []);

  useEffect(() => {
    engineRef.current?.scheduler.setPattern(patternRef.current);
  }, [pattern]);

  useEffect(() => {
    return () => {
      engineRef.current?.scheduler.stop();
      engineRef.current?.audioCtx.close();
    };
  }, []);

  const toggle = useCallback(async () => {
    const { audioCtx, scheduler } = ensureEngine();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    if (scheduler.isRunning) {
      scheduler.stop();
      setIsPlaying(false);
      setCurrentStep(-1);
    } else {
      scheduler.setPattern(patternRef.current);
      scheduler.start();
      setIsPlaying(true);
    }
  }, [ensureEngine]);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    if (engine?.scheduler.isRunning) {
      engine.scheduler.stop();
      setIsPlaying(false);
      setCurrentStep(-1);
    }
  }, []);

  return { isPlaying, currentStep, toggle, stop };
}
