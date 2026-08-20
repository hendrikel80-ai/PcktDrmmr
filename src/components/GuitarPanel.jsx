import { useRef, useState } from 'react';

export default function GuitarPanel({
  supported,
  connected,
  devices,
  selectedDeviceId,
  modelInfo,
  onConnect,
  onDisconnect,
  onRefreshDevices,
  onLoadModel,
  onLoadCabinetIR,
  onClearCabinetIR,
  onInputGainChange,
  onOutputGainChange,
}) {
  const [error, setError] = useState('');
  const [hasCabinetIR, setHasCabinetIR] = useState(false);
  const modelInputRef = useRef(null);
  const irInputRef = useRef(null);

  async function handleConnect() {
    setError('');
    try {
      await onConnect();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeviceChange(e) {
    setError('');
    try {
      await onConnect(e.target.value);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleModelFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      await onLoadModel(file);
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = '';
    }
  }

  async function handleIrFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      await onLoadCabinetIR(file);
      setHasCabinetIR(true);
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = '';
    }
  }

  function handleClearIr() {
    onClearCabinetIR();
    setHasCabinetIR(false);
  }

  if (!supported) {
    return (
      <div className="guitar-panel guitar-panel--unsupported">
        Gitarren-Eingang: Browser unterstützt getUserMedia nicht.
      </div>
    );
  }

  return (
    <div className="guitar-panel">
      <div className="guitar-panel__row">
        {!connected ? (
          <button type="button" className="guitar-panel__connect" onClick={handleConnect}>
            🎸 Gitarre verbinden
          </button>
        ) : (
          <>
            <select
              className="guitar-panel__select"
              value={selectedDeviceId ?? ''}
              onChange={handleDeviceChange}
              onFocus={onRefreshDevices}
            >
              {devices.length === 0 && <option value="">Kein Eingang gefunden</option>}
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button type="button" className="guitar-panel__disconnect" onClick={onDisconnect}>
              Trennen
            </button>
          </>
        )}
        {error && <span className="guitar-panel__error">{error}</span>}
      </div>

      {connected && (
        <div className="guitar-panel__row">
          <button type="button" className="guitar-panel__file-btn" onClick={() => modelInputRef.current?.click()}>
            🎛 Amp-Modell laden (.nam)
          </button>
          <input
            ref={modelInputRef}
            type="file"
            accept=".nam,.json"
            className="guitar-panel__file-input"
            onChange={handleModelFile}
          />
          {modelInfo && (
            <span className="guitar-panel__model-info">
              {modelInfo.name}
              {modelInfo.expectedSampleRate ? ` · ${modelInfo.expectedSampleRate} Hz` : ''}
            </span>
          )}

          <button type="button" className="guitar-panel__file-btn" onClick={() => irInputRef.current?.click()}>
            🔊 Cabinet-IR laden (.wav)
          </button>
          <input
            ref={irInputRef}
            type="file"
            accept=".wav"
            className="guitar-panel__file-input"
            onChange={handleIrFile}
          />
          {hasCabinetIR && (
            <button type="button" className="guitar-panel__file-btn" onClick={handleClearIr}>
              IR entfernen
            </button>
          )}
        </div>
      )}

      {connected && (
        <div className="guitar-panel__row guitar-panel__gains">
          <label>
            Input
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              defaultValue={1}
              onChange={(e) => onInputGainChange(Number(e.target.value))}
            />
          </label>
          <label>
            Output
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              defaultValue={1}
              onChange={(e) => onOutputGainChange(Number(e.target.value))}
            />
          </label>
          <span className="guitar-panel__latency-hint">
            Browser-Audio hat etwas mehr Latenz als native ASIO/CoreAudio-Setups — zum Mitspielen unkritisch.
          </span>
        </div>
      )}
    </div>
  );
}
