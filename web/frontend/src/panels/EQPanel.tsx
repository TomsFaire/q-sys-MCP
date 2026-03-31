import { useState, useCallback, useMemo } from 'react';
import type { CoreState } from '../types.js';

interface EQPanelProps {
  state: CoreState;
  setControl: (component: string, name: string, value: number | boolean) => void;
}

const EQ_BLOCKS = [
  { id: 'Parametric_Equalizer', label: 'PEQ — Mic Group 1', bands: 5 },
  { id: 'Parametric_Equalizer_1', label: 'PEQ — Mic Group 2', bands: 4 },
  { id: 'Parametric_Equalizer_2', label: 'PEQ — Mic Group 3', bands: 4 },
  { id: 'Parametric_Equalizer_3', label: 'PEQ — Output', bands: 6 },
];

const FREQ_MIN = 20;
const FREQ_MAX = 20000;

function peakMagnitude(f: number, freq: number, gainDb: number, bw: number): number {
  const ratio = f / freq;
  const logRatio = Math.log2(ratio);
  const gaussian = Math.exp(-(logRatio * logRatio) / (2 * (bw * bw * 0.36)));
  return gainDb * gaussian;
}

interface BandState {
  freq: number;
  gain: number;
  bw: number;
  bypass: boolean;
}

function buildCurve(bands: BandState[], width: number, height: number): string {
  const points: [number, number][] = [];
  const steps = 200;
  const gainRange = 20;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const logF = Math.log10(FREQ_MIN) + t * (Math.log10(FREQ_MAX) - Math.log10(FREQ_MIN));
    const f = Math.pow(10, logF);

    let totalDb = 0;
    for (const b of bands) {
      if (!b.bypass && b.gain !== 0) {
        totalDb += peakMagnitude(f, b.freq, b.gain, b.bw);
      }
    }

    const x = t * width;
    const y = height / 2 - (totalDb / gainRange) * (height / 2) * 0.85;
    points.push([x, Math.max(2, Math.min(height - 2, y))]);
  }

  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

interface EditCellProps {
  value: number;
  step?: number;
  min?: number;
  max?: number;
  fmt?: (v: number) => string;
  onChange: (v: number) => void;
}

function EditCell({ value, step = 1, min = -999, max = 999, fmt, onChange }: EditCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const display = fmt ? fmt(value) : value.toString();

  const commit = () => {
    setEditing(false);
    const n = parseFloat(draft);
    if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
  };

  if (editing) {
    return (
      <input
        autoFocus
        className="w-20 rounded-faire-sm border border-faire-border bg-faire-card px-2 py-1 text-center font-mono text-label text-faire-text focus:border-faire-border-strong focus:outline-none"
        value={draft}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="cursor-pointer font-mono text-label tabular-nums text-faire-text underline decoration-faire-border decoration-1 underline-offset-2 hover:text-faire-action-hover"
      onDoubleClick={() => {
        setDraft(value.toString());
        setEditing(true);
      }}
      title="Double-click to edit"
    >
      {display}
    </span>
  );
}

interface EqBlockEditorProps {
  component: string;
  label: string;
  bandCount: number;
  state: CoreState;
  setControl: (component: string, name: string, value: number | boolean) => void;
}

function EqBlockEditor({ component, label, bandCount, state, setControl }: EqBlockEditorProps) {
  const compState = state[component] ?? {};

  const getBands = useCallback((): BandState[] => {
    return Array.from({ length: bandCount }, (_, i) => {
      const b = i + 1;
      return {
        freq: (compState[`frequency.${b}`]?.value as number) ?? 1000,
        gain: (compState[`gain.${b}`]?.value as number) ?? 0,
        bw: (compState[`bandwidth.${b}`]?.value as number) ?? 1,
        bypass: !!(compState[`bypass.${b}`]?.value),
      };
    });
  }, [compState, bandCount]);

  const bands = getBands();

  const SVG_W = 480;
  const SVG_H = 100;
  const path = useMemo(() => buildCurve(bands, SVG_W, SVG_H), [bands]);

  const isBlocked = state[component] === undefined;

  if (isBlocked) {
    return (
      <div className="faire-panel">
        <p className="text-body text-faire-subdued">{label} — not available in snapshot</p>
      </div>
    );
  }

  const masterGain = (compState['master.gain']?.value as number) ?? 0;
  const blocked = !!(compState['bypass']?.value);

  return (
    <div className="faire-panel flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-faire-border pb-4">
        <h3 className="faire-heading-section">{label}</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-label text-faire-subdued">Master</span>
            <EditCell
              value={masterGain}
              step={0.1}
              min={-20}
              max={20}
              fmt={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
              onChange={(v) => setControl(component, 'master.gain', v)}
            />
          </div>
          <button
            type="button"
            onClick={() => setControl(component, 'bypass', !blocked)}
            className={`rounded-faire-sm border px-3 py-1.5 text-label font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-faire-focus ${
              blocked
                ? 'border-faire-warning-border bg-faire-warning-surface text-faire-warning-text'
                : 'border-faire-border bg-faire-card text-faire-text hover:bg-faire-tertiary'
            }`}
          >
            {blocked ? 'Bypassed' : 'Bypass'}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-faire-sm border border-faire-border bg-faire-neutral">
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ height: SVG_H }}>
          {[-12, -6, 0, 6, 12].map((db) => {
            const y = SVG_H / 2 - (db / 20) * SVG_H * 0.85 * 0.5 * 2;
            return (
              <g key={db}>
                <line
                  x1={0}
                  y1={y}
                  x2={SVG_W}
                  y2={y}
                  stroke={db === 0 ? '#757575' : '#dfe0e1'}
                  strokeWidth={db === 0 ? 1 : 0.5}
                />
                <text x={4} y={y - 2} fill="#757575" fontSize={7} fontFamily="Inter, sans-serif">
                  {db > 0 ? '+' : ''}
                  {db} dB
                </text>
              </g>
            );
          })}
          {[100, 1000, 10000].map((f) => {
            const t = (Math.log10(f) - Math.log10(FREQ_MIN)) / (Math.log10(FREQ_MAX) - Math.log10(FREQ_MIN));
            const x = t * SVG_W;
            return <line key={f} x1={x} y1={0} x2={x} y2={SVG_H} stroke="#dfe0e1" strokeWidth={0.5} />;
          })}
          <path d={path} fill="none" stroke="#333333" strokeWidth={1.5} />
        </svg>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-faire-border bg-faire-secondary">
              <th className="py-3 pr-4 text-left text-label font-medium text-faire-subdued">Band</th>
              <th className="px-3 py-3 text-center text-label font-medium text-faire-subdued">Freq (Hz)</th>
              <th className="px-3 py-3 text-center text-label font-medium text-faire-subdued">Gain (dB)</th>
              <th className="px-3 py-3 text-center text-label font-medium text-faire-subdued">BW (oct)</th>
              <th className="px-3 py-3 text-center text-label font-medium text-faire-subdued">Bypass</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b, i) => {
              const idx = i + 1;
              return (
                <tr key={idx} className={`border-b border-faire-border ${b.bypass ? 'opacity-50' : ''}`}>
                  <td className="py-3 pr-4 text-left text-body text-faire-subdued">Band {idx}</td>
                  <td className="px-3 py-3 text-center">
                    <EditCell
                      value={b.freq}
                      step={10}
                      min={20}
                      max={20000}
                      fmt={(v) => (v >= 1000 ? `${(v / 1000).toFixed(2)}k` : `${v.toFixed(0)}`)}
                      onChange={(v) => setControl(component, `frequency.${idx}`, v)}
                    />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <EditCell
                      value={b.gain}
                      step={0.1}
                      min={-20}
                      max={20}
                      fmt={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
                      onChange={(v) => setControl(component, `gain.${idx}`, v)}
                    />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <EditCell
                      value={b.bw}
                      step={0.1}
                      min={0.1}
                      max={4}
                      fmt={(v) => v.toFixed(2)}
                      onChange={(v) => setControl(component, `bandwidth.${idx}`, v)}
                    />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setControl(component, `bypass.${idx}`, !b.bypass)}
                      className={`rounded-faire-sm border px-2 py-1 text-label font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-faire-focus ${
                        b.bypass
                          ? 'border-faire-warning-border bg-faire-warning-surface text-faire-warning-text'
                          : 'border-faire-border bg-faire-card text-faire-subdued hover:border-faire-border-strong'
                      }`}
                    >
                      {b.bypass ? 'On' : 'Off'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EQPanel({ state, setControl }: EQPanelProps) {
  const [selected, setSelected] = useState(0);
  const block = EQ_BLOCKS[selected];

  return (
    <div className="flex min-h-0 flex-col gap-0 lg:flex-row">
      <aside className="w-full shrink-0 border-faire-border lg:w-56 lg:border-r lg:pr-6">
        <div className="mb-4 text-label font-medium text-faire-subdued">Equalizers</div>
        <nav className="flex flex-col gap-1">
          {EQ_BLOCKS.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelected(i)}
              className={`rounded-faire-sm border px-3 py-2.5 text-left text-body transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-faire-focus ${
                i === selected
                  ? 'border-faire-border-strong bg-faire-tertiary font-medium text-faire-text'
                  : 'border-transparent bg-transparent text-faire-subdued hover:bg-faire-secondary hover:text-faire-text'
              }`}
            >
              {b.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 pt-8 lg:pt-0 lg:pl-8">
        <div className="mb-8 lg:hidden">
          <h2 className="faire-heading-section">Equalizer</h2>
          <p className="mt-1 text-body text-faire-subdued">Select a block, then edit bands below.</p>
        </div>
        <EqBlockEditor
          key={block.id}
          component={block.id}
          label={block.label}
          bandCount={block.bands}
          state={state}
          setControl={setControl}
        />
      </div>
    </div>
  );
}
