import { useEffect, useState } from 'react';

export default function GuitarPanel({
  supported,
  connected,
  devices,
  selectedDeviceId,
  onConnect,
  onDisconnect,
  onRefreshDevices,
  onInputGainChange,
  onOutputGainChange,
  onBassChange,
  onMidChange,
  onTrebleChange,
  onReverbChange,
  onGetLatencyInfo,
}) {
  const [error, setError] = useState('');
  const [latencyInfo, setLatencyInfo] = useState(null);

  function refreshLatency() {
    setLatencyInfo(onGetLatencyInfo());
  }

  useEffect(() => {
    if (connected) refreshLatency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

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
        <div className="guitar-panel__row guitar-panel__gains">
          <label title="Pegel vor der Verzerrungsstufe — mehr Gain = mehr Sättigung, wie bei einem echten Amp">
            Gain
            <input
              type="range"
              min={0}
              max={8}
              step={0.1}
              defaultValue={1}
              onChange={(e) => onInputGainChange(Number(e.target.value))}
            />
          </label>
          <label>
            Bass
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              defaultValue={0}
              onChange={(e) => onBassChange(Number(e.target.value))}
            />
          </label>
          <label>
            Middle
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              defaultValue={0}
              onChange={(e) => onMidChange(Number(e.target.value))}
            />
          </label>
          <label>
            Treble
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              defaultValue={0}
              onChange={(e) => onTrebleChange(Number(e.target.value))}
            />
          </label>
          <label title="Anteil des Raumhalls (Reverb), der zum trockenen Signal zugemischt wird">
            Reverb
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              defaultValue={0.15}
              onChange={(e) => onReverbChange(Number(e.target.value))}
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
        </div>
      )}

      {connected && (
        <div className="guitar-panel__row guitar-panel__latency">
          <button type="button" className="guitar-panel__file-btn" onClick={refreshLatency}>
            🔄 Latenz messen
          </button>
          {latencyInfo && (
            <span className="guitar-panel__latency-value">
              ~{latencyInfo.totalMs} ms
              {latencyInfo.totalIsPartial ? '+' : ''} (
              {latencyInfo.inputMs !== null && <>{latencyInfo.inputMs} Eingabe + </>}
              {latencyInfo.baseMs} Puffer + {latencyInfo.outputMs} Ausgabe, @{latencyInfo.sampleRate} Hz)
              {latencyInfo.totalIsPartial && ' — Eingabe-Latenz vom Browser nicht gemeldet, Summe unvollständig'}
            </span>
          )}
          <span className="guitar-panel__latency-hint">
            Eigener Amp-Simulator aus nativen Web-Audio-Nodes — keine Neural-Net-Inferenz, also keine
            zusätzliche Rechen-Latenz obendrauf. Verbleibende Latenz ist reine Browser-/Windows-
            Audio-Pipeline (WASAPI), zum Mitspielen unkritisch.
          </span>
        </div>
      )}
    </div>
  );
}
