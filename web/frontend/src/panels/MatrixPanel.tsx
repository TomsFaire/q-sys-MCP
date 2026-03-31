import { useState, useCallback } from 'react';
import type { CoreState, MixerLayoutInfo, UiLayout } from '../types.js';

interface MatrixPanelProps {
  state: CoreState;
  layout: UiLayout | null;
  setControl: (component: string, name: string, value: number | boolean) => void;
}

function xpGainKey(i: number, o: number) {
  return `input.${i}.output.${o}.gain`;
}
function xpMuteKey(i: number, o: number) {
  return `input.${i}.output.${o}.mute`;
}
function inputMuteKey(i: number) {
  return `input.${i}.mute`;
}

interface CellProps {
  gain: number;
  muted: boolean;
  onGainChange: (v: number) => void;
  onMuteToggle: () => void;
}

function XpCell({ gain, muted, onGainChange, onMuteToggle }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const silent = gain <= -100;

  const commit = () => {
    setEditing(false);
    const n = parseFloat(draft);
    if (!isNaN(n)) onGainChange(Math.max(-100, Math.min(20, n)));
  };

  return (
    <td
      className={`relative min-w-[68px] select-none border border-faire-border ${
        silent ? 'bg-faire-tertiary' : muted ? 'bg-faire-error-surface' : 'bg-faire-card'
      }`}
      style={{ height: 40 }}
    >
      <div className="flex h-full items-center justify-between gap-0.5 px-1">
        {editing ? (
          <input
            autoFocus
            className="w-12 rounded-faire-sm border border-faire-border bg-faire-card px-1 py-0.5 font-mono text-label text-faire-text focus:border-faire-border-strong focus:outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span
            onDoubleClick={() => {
              setDraft(silent ? '-inf' : gain.toFixed(1));
              setEditing(true);
            }}
            className={`flex-1 cursor-text text-center font-mono text-label tabular-nums ${
              silent ? 'text-faire-subdued' : muted ? 'text-faire-error-text' : 'text-faire-text'
            }`}
          >
            {silent ? '−∞' : `${gain > 0 ? '+' : ''}${gain.toFixed(1)}`}
          </span>
        )}
        <button
          type="button"
          onClick={onMuteToggle}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-faire-sm border text-[9px] font-medium leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-faire-focus ${
            muted
              ? 'border-faire-error-border bg-faire-error-surface text-faire-error-text'
              : 'border-faire-border bg-faire-secondary text-faire-subdued hover:border-faire-border-strong hover:text-faire-text'
          }`}
          title={muted ? 'Unmute' : 'Mute'}
        >
          M
        </button>
      </div>
    </td>
  );
}

function MixerTable({
  mixer,
  state,
  setControl,
}: {
  mixer: MixerLayoutInfo;
  state: CoreState;
  setControl: (component: string, name: string, value: number | boolean) => void;
}) {
  const COMPONENT = mixer.name;
  const compState = state[COMPONENT] ?? {};

  const getXpGain = useCallback(
    (i: number, o: number): number => {
      const v = compState[xpGainKey(i, o)]?.value;
      return typeof v === 'number' ? v : -100;
    },
    [compState],
  );

  const getXpMute = useCallback(
    (i: number, o: number): boolean => {
      const v = compState[xpMuteKey(i, o)]?.value;
      return v === true || v === 1;
    },
    [compState],
  );

  const getInputMute = useCallback(
    (i: number): boolean => {
      const v = compState[inputMuteKey(i)]?.value;
      return v === true || v === 1;
    },
    [compState],
  );

  const INPUTS = mixer.inputCount;
  const OUTPUTS = mixer.outputCount;

  return (
    <div className="faire-panel overflow-hidden p-0">
      <div className="border-b border-faire-border bg-faire-secondary px-4 py-3">
        <h3 className="text-section font-medium text-faire-text">{mixer.name}</h3>
        <p className="mt-0.5 text-label text-faire-subdued">
          {INPUTS} × {OUTPUTS} crosspoints
        </p>
      </div>
      <div className="max-w-full overflow-auto">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 border-b border-faire-border bg-faire-secondary px-3 py-3 text-left text-label font-medium text-faire-subdued"
                style={{ minWidth: 112 }}
              >
                Input \ Output
              </th>
              {Array.from({ length: OUTPUTS }, (_, odx) => {
                const lbl = mixer.outputLabels[odx] ?? `Out ${odx + 1}`;
                return (
                  <th
                    key={odx}
                    className="min-w-[68px] border-b border-faire-border bg-faire-secondary px-1 py-3 text-center text-label font-medium text-faire-subdued"
                  >
                    {lbl}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: INPUTS }, (_, idx) => {
              const i = idx + 1;
              const inputMuted = getInputMute(i);
              const rowLabel = mixer.inputLabels[idx] ?? `Input ${i}`;
              return (
                <tr key={i} className={inputMuted ? 'opacity-60' : ''}>
                  <td className="sticky left-0 z-10 border-b border-faire-border bg-faire-secondary px-2 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setControl(COMPONENT, inputMuteKey(i), !inputMuted)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-faire-sm border text-[9px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-faire-focus ${
                          inputMuted
                            ? 'border-faire-error-border bg-faire-error-surface text-faire-error-text'
                            : 'border-faire-border bg-faire-card text-faire-subdued hover:border-faire-border-strong'
                        }`}
                      >
                        M
                      </button>
                      <span
                        className={`min-w-0 truncate text-body ${inputMuted ? 'text-faire-subdued line-through' : 'text-faire-text'}`}
                      >
                        {rowLabel}
                      </span>
                    </div>
                  </td>
                  {Array.from({ length: OUTPUTS }, (_, odx) => {
                    const o = odx + 1;
                    return (
                      <XpCell
                        key={o}
                        gain={getXpGain(i, o)}
                        muted={getXpMute(i, o)}
                        onGainChange={(v) => setControl(COMPONENT, xpGainKey(i, o), v)}
                        onMuteToggle={() => setControl(COMPONENT, xpMuteKey(i, o), !getXpMute(i, o))}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MatrixPanel({ state, layout, setControl }: MatrixPanelProps) {
  if (!layout) {
    return (
      <div className="faire-panel max-w-lg">
        <p className="text-body text-faire-subdued">Waiting for layout from the Core…</p>
      </div>
    );
  }

  if (layout.mixers.length === 0) {
    return (
      <div className="faire-panel max-w-lg">
        <p className="text-body text-faire-text">No mixer found</p>
        <p className="mt-2 text-body text-faire-subdued">
          This design has no <code className="rounded-faire-sm bg-faire-tertiary px-1">mixer</code> component with crosspoint controls, or it is not exposed to the API.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="faire-heading-section">Matrix</h2>
        <p className="mt-1 text-body text-faire-subdued">
          Double-click a cell to edit gain (dB). Use M to mute a crosspoint or an entire input row.
        </p>
      </div>
      <div className="flex flex-col gap-10">
        {layout.mixers.map((m) => (
          <MixerTable key={m.name} mixer={m} state={state} setControl={setControl} />
        ))}
      </div>
    </div>
  );
}
