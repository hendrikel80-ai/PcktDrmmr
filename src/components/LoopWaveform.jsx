import { useEffect, useRef } from 'react';

// Visualizes a loop-enabled recording's waveform with the actual
// loopStart/loopEnd points marked (green/red) — lets the user see at a
// glance where the seamless loop (see RecordingPanel.jsx's "▶ Loop"
// button) starts and ends, and how the trim stepper is affecting it.

const WIDTH = 540;
const HEIGHT = 60;

function drawWaveform(canvas, buffer, loopStart, loopEnd) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#120b06';
  ctx.fillRect(0, 0, width, height);

  const data = buffer.getChannelData(0);
  const mid = height / 2;

  ctx.strokeStyle = '#d99a3f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const sliceStart = Math.floor((x / width) * data.length);
    const sliceEnd = Math.max(sliceStart + 1, Math.floor(((x + 1) / width) * data.length));
    let min = 0;
    let max = 0;
    for (let i = sliceStart; i < sliceEnd && i < data.length; i++) {
      const v = data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    ctx.moveTo(x + 0.5, mid - max * mid);
    ctx.lineTo(x + 0.5, mid - min * mid);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(width, mid);
  ctx.stroke();

  [
    { seconds: loopStart, color: '#4ade80' },
    { seconds: loopEnd, color: '#f87171' },
  ].forEach(({ seconds, color }) => {
    if (seconds == null) return;
    const x = (seconds / buffer.duration) * width;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  });
}

export default function LoopWaveform({ buffer, loopStart, loopEnd }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!buffer || !canvasRef.current) return;
    drawWaveform(canvasRef.current, buffer, loopStart, loopEnd);
  }, [buffer, loopStart, loopEnd]);

  return (
    <div className="loop-waveform">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="loop-waveform__canvas" />
      <div className="loop-waveform__legend">
        <span className="loop-waveform__legend-item">
          <span className="loop-waveform__swatch" style={{ background: '#4ade80' }} /> loop start
        </span>
        <span className="loop-waveform__legend-item">
          <span className="loop-waveform__swatch" style={{ background: '#f87171' }} /> loop end
        </span>
      </div>
    </div>
  );
}
