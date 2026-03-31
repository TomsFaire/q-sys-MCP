import { Fader } from '../components/Fader.js';
import type { CoreState, GainBlockInfo, UiLayout } from '../types.js';

interface GainsPanelProps {
  state: CoreState;
  layout: UiLayout | null;
  setControl: (component: string, name: string, value: number | boolean) => void;
}

function GainBlockColumn({
  block,
  state,
  setControl,
}: {
  block: GainBlockInfo;
  state: CoreState;
  setControl: (component: string, name: string, value: number | boolean) => void;
}) {
  const comp = state[block.name] ?? {};

  return (
    <div className="faire-panel w-fit max-w-full">
      <div className="border-b border-faire-border pb-3">
        <h3 className="text-section font-medium text-faire-text">{block.name}</h3>
        <p className="mt-0.5 text-label text-faire-subdued">
          {block.channels.length} channel{block.channels.length !== 1 ? 's' : ''} · range {block.gainMin}…{block.gainMax} dB
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-8">
        {block.channels.map((ch) => {
          const raw = comp[ch.gainKey]?.value;
          const value = typeof raw === 'number' ? raw : 0;
          const mv = comp[ch.muteKey]?.value;
          const muted = mv === true || mv === 1;
          const bypassed = comp['bypass']?.value === true || comp['bypass']?.value === 1;

          return (
            <div key={ch.gainKey} className={`flex flex-col items-center ${bypassed ? 'opacity-50' : ''}`}>
              <Fader
                label={block.channels.length > 1 ? ch.label : block.name}
                value={value}
                min={block.gainMin}
                max={block.gainMax}
                muted={muted}
                onValueChange={(v) => setControl(block.name, ch.gainKey, v)}
                onMuteToggle={() => setControl(block.name, ch.muteKey, !muted)}
              />
              {bypassed && (
                <span className="mt-1 text-label font-medium text-faire-warning-text">Bypass</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GainsPanel({ state, layout, setControl }: GainsPanelProps) {
  if (!layout) {
    return (
      <div className="faire-panel max-w-lg">
        <p className="text-body text-faire-subdued">Waiting for layout from the Core…</p>
      </div>
    );
  }

  if (layout.gains.length === 0) {
    return (
      <div className="faire-panel max-w-lg">
        <p className="text-body text-faire-text">No gain blocks found</p>
        <p className="mt-2 text-body text-faire-subdued">
          This design has no <code className="rounded-faire-sm bg-faire-tertiary px-1">gain</code> components with Script Access, or they are not exposed to the API.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="faire-heading-section">Gains</h2>
        <p className="mt-1 max-w-2xl text-body text-faire-subdued">
          All single- and multi-channel gain components discovered on the Core. Labels come from the design.
        </p>
      </div>
      <div className="flex flex-col gap-10">
        {layout.gains.map((block) => (
          <GainBlockColumn key={block.name} block={block} state={state} setControl={setControl} />
        ))}
      </div>
    </div>
  );
}
