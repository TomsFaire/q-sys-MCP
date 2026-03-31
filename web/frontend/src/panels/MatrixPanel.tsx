import { useState, useCallback } from 'react';
import type { CoreState } from '../types.js';

interface MatrixPanelProps {
  state: CoreState;
  setControl: (component: string, name: string, value: number | boolean) => void;
}

const COMPONENT = 'Mixer_8x8';

const INPUT_LABELS = [
  'VC Mic 1', 'VC Mic 2', 'VC Mic 3', 'VC Mic 4',
  'VC Mic 5', 'VC Mic 6', 'VC Mic 7', 'VC Mic 8',
  'HH 1', 'HH 2', 'Music', 'VTC IN', 'All Hands',
];

const OUTPUT_LABELS = [
  'Speakers', 'Zoom Tx', 'AEC Ref 1', 'AEC Ref 2',
  'AEC WL 5', 'AEC WL 6', 'AEC WL 7', 'AEC WL 8',
  'Ovfl SPK', 'Rec L', 'Rec R',
];

const INPUTS = INPUT_LABELS.length;
const OUTPUTS = OUTPUT_LABELS.length;

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

  const handleDblClick = () => {
    setDraft(silent ? '-inf' : gain.toFixed(1));
    setEditing(true);
  };

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
            onDoubleClick={handleDblClick}
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

export function MatrixPanel({ state, setControl }: MatrixPanelProps) {
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

  return (
    <div>
      <div className="mb-8">
        <h2 className="faire-heading-section">Mixer matrix</h2>
        <p className="mt-1 text-body text-faire-subdued">
          {INPUTS} × {OUTPUTS} crosspoints. Double-click a cell to edit gain (dB). Use M to mute a crosspoint.
        </p>
      </div>

      <div className="faire-panel overflow-hidden p-0">
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
                {OUTPUT_LABELS.map((lbl, o) => (
                  <th
                    key={o}
                    className="min-w-[68px] border-b border-faire-border bg-faire-secondary px-1 py-3 text-center text-label font-medium text-faire-subdued"
                  >
                    {lbl}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: INPUTS }, (_, idx) => {
                const i = idx + 1;
                const inputMuted = getInputMute(i);
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
                          {INPUT_LABELS[idx]}
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
    </div>
  );
}
