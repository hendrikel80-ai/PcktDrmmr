import { useState } from 'react';
import { DEFAULT_PATTERN } from './data/defaultPattern';
import { useAudioEngine } from './audio/useAudioEngine';
import StepSequencer from './components/StepSequencer';
import Transport from './components/Transport';
import PromptBar from './components/PromptBar';

export default function App() {
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const { isPlaying, currentStep, toggle, stop } = useAudioEngine(pattern);

  function handleBpmChange(bpm) {
    setPattern((p) => ({ ...p, bpm }));
  }

  function handleGenerated(newPattern) {
    stop();
    setPattern(newPattern);
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>🥁 Pocket Drummer</h1>
        <p className="app__subtitle">Übungsbeats zum Mitspielen — Step-Sequencer</p>
      </header>

      <PromptBar onGenerate={handleGenerated} />

      <Transport
        isPlaying={isPlaying}
        onToggle={toggle}
        bpm={pattern.bpm}
        onBpmChange={handleBpmChange}
        styleDescription={pattern.style_description}
      />

      <StepSequencer pattern={pattern} currentStep={currentStep} onChange={setPattern} />

      <footer className="app__footer">
        <p>Steps anklicken zum Programmieren (Aus → Ghost → Normal → Akzent).</p>
      </footer>
    </div>
  );
}
