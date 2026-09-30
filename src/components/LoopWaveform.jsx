import { useEffect, useRef } from 'react';

// Visualizes a loop-enabled recording's waveform with the actual
// loopStart/loopEnd points marked (green/red) — lets the user see at a
// glance where the seamless loop (see RecordingPanel.jsx's "▶ Loop"
// button) starts and ends, and how the trim stepper is affecting it. When
// onLoopStartChange/onLoopEndChange are passed, both markers are also
// directly draggable with the mouse (or a finger, via Pointer Events).

const WIDTH = 540;
const HEIGHT = 60;
// Hit-test tolerance for grabbing a marker line, in the canvas' own
// internal coordinate space (see xToSeconds' rect-based scaling below for
// why this can't just be a CSS pixel value) — generous enough for a mouse
// pointer or a fingertip without the two markers' hit zones overlapping at
// this canvas' typical loop lengths.
const HIT_RADIUS_PX = 10;

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

export default function LoopWaveform({ buffer, loopStart, loopEnd, onLoopStartChange, onLoopEndChange }) {
  const canvasRef = useRef(null);
  // Which marker a drag in progress is moving ('start' | 'end' | null) —
  // a ref, not state, since pointermove fires far too often to route
  // through React re-renders just to remember which line is grabbed.
  const draggingRef = useRef(null);

  useEffect(() => {
    if (!buffer || !canvasRef.current) return;
    drawWaveform(canvasRef.current, buffer, loopStart, loopEnd);
  }, [buffer, loopStart, loopEnd]);

  const interactive = Boolean(onLoopStartChange || onLoopEndChange);

  // Canvas' internal drawing surface (WIDTH×HEIGHT) is stretched to
  // whatever CSS width it actually renders at (see .loop-waveform__canvas'
  // width:100%) — clientX has to go through the DOM-rendered rect, not the
  // WIDTH constant, to land on the right sample.
  function xToSeconds(clientX) {
    const rect = canvasRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(buffer.duration, ratio * buffer.duration));
  }

  function secondsToClientX(seconds, rect) {
    return rect.left + (seconds / buffer.duration) * rect.width;
  }

  function nearestMarker(clientX, rect) {
    const hitRadius = (HIT_RADIUS_PX / WIDTH) * rect.width;
    const startX = secondsToClientX(loopStart, rect);
    const endX = secondsToClientX(loopEnd, rect);
    const distToStart = Math.abs(clientX - startX);
    const distToEnd = Math.abs(clientX - endX);
    if (distToStart > hitRadius && distToEnd > hitRadius) return null;
    return distToStart <= distToEnd ? 'start' : 'end';
  }

  function handlePointerDown(e) {
    if (!interactive || !buffer) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const marker = nearestMarker(e.clientX, rect);
    if (!marker) return;
    if (marker === 'start' && !onLoopStartChange) return;
    if (marker === 'end' && !onLoopEndChange) return;
    draggingRef.current = marker;
    canvasRef.current.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function handlePointerMove(e) {
    if (!buffer) return;
    if (!draggingRef.current) {
      // Not dragging — just hover feedback, done via direct style mutation
      // (not React state) so moving the mouse over a static waveform never
      // triggers a re-render.
      if (interactive) {
        const rect = canvasRef.current.getBoundingClientRect();
        canvasRef.current.style.cursor = nearestMarker(e.clientX, rect) ? 'ew-resize' : 'default';
      }
      return;
    }
    const seconds = xToSeconds(e.clientX);
    if (draggingRef.current === 'start') onLoopStartChange?.(seconds);
    else onLoopEndChange?.(seconds);
  }

  function handlePointerUp(e) {
    if (!draggingRef.current) return;
    draggingRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // capture already released (e.g. pointercancel beat us to it) - fine
    }
  }

  return (
    <div className="loop-waveform">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="loop-waveform__canvas"
        style={interactive ? { touchAction: 'none' } : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div className="loop-waveform__legend">
        <span className="loop-waveform__legend-item">
          <span className="loop-waveform__swatch" style={{ background: '#4ade80' }} /> loop start
        </span>
        <span className="loop-waveform__legend-item">
          <span className="loop-waveform__swatch" style={{ background: '#f87171' }} /> loop end
        </span>
        {interactive && <span className="loop-waveform__hint">Drag a line to move it</span>}
      </div>
    </div>
  );
}
