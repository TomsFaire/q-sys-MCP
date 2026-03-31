import { useRef, useCallback } from 'react';

interface MuteButtonProps {
  muted: boolean;
  onToggle: () => void;
  small?: boolean;
}

export function MuteButton({ muted, onToggle, small = false }: MuteButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        select-none rounded-faire-sm border font-medium transition-colors
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-faire-focus
        ${small ? 'px-1.5 py-0.5 text-label' : 'px-2 py-1 text-label'}
        ${
          muted
            ? 'border-faire-error-border bg-faire-error-surface text-faire-error-text'
            : 'border-faire-border bg-faire-card text-faire-text hover:border-faire-border-strong hover:bg-faire-tertiary'
        }
      `}
    >
      Mute
    </button>
  );
}

interface FaderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  muted: boolean;
  onValueChange: (v: number) => void;
  onMuteToggle: () => void;
}

const DEFAULT_MIN = -100;
const DEFAULT_MAX = 20;

function dbToPercent(db: number, min: number, max: number) {
  return Math.max(0, Math.min(1, (db - min) / (max - min)));
}

function percentToDb(p: number, min: number, max: number) {
  return p * (max - min) + min;
}

export function Fader({ label, value, min = DEFAULT_MIN, max = DEFAULT_MAX, muted, onValueChange, onMuteToggle }: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const getDb = useCallback(
    (clientY: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return value;
      const p = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      return Math.round(percentToDb(p, min, max) * 10) / 10;
    },
    [value, min, max],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      onValueChange(getDb(e.clientY));

      const onMove = (ev: MouseEvent) => {
        if (dragging.current) onValueChange(getDb(ev.clientY));
      };
      const onUp = () => {
        dragging.current = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [getDb, onValueChange],
  );

  const pct = dbToPercent(value, min, max);
  const atFloor = value <= min + 0.01;
  const dbLabel = atFloor ? '−∞' : `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

  return (
    <div className="flex w-16 flex-col items-center gap-2">
      <span className="max-w-full truncate px-0.5 text-center text-label text-faire-subdued">{label}</span>
      <span
        className={`font-mono text-label tabular-nums ${muted ? 'text-faire-error-text' : 'text-faire-text'}`}
      >
        {dbLabel}
      </span>

      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        className={`relative h-40 w-3 cursor-pointer select-none rounded-faire-sm border bg-faire-tertiary ${
          muted ? 'border-faire-error-border' : 'border-faire-border'
        }`}
      >
        <div
          className={`absolute bottom-0 left-0 right-0 rounded-b-faire-sm transition-none ${
            muted ? 'bg-faire-error-border' : 'bg-faire-action'
          }`}
          style={{ height: `${pct * 100}%` }}
        />
        <div
          className={`absolute left-1/2 w-5 -translate-x-1/2 rounded-faire-sm border-2 bg-faire-card ${
            muted ? 'border-faire-error-text' : 'border-faire-border-strong'
          }`}
          style={{ bottom: `calc(${pct * 100}% - 5px)`, height: '10px' }}
        />
        {min <= 0 && max >= 0 && (
          <div
            className="absolute left-0 right-0 h-px bg-faire-border-strong opacity-50"
            style={{ bottom: `${dbToPercent(0, min, max) * 100}%` }}
          />
        )}
      </div>

      <MuteButton muted={muted} onToggle={onMuteToggle} small />
    </div>
  );
}
