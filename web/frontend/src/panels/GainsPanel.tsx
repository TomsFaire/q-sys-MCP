import { Fader } from '../components/Fader.js';
import type { CoreState } from '../types.js';

interface GainsPanelProps {
  state: CoreState;
  setControl: (component: string, name: string, value: number | boolean) => void;
}

const SOURCE_GAINS: Array<{ id: string; label: string; min: number; max: number }> = [
  { id: 'Mic 1 Gain', label: 'Mic 1', min: -100, max: 20 },
  { id: 'Mic 2 Gain', label: 'Mic 2', min: -100, max: 20 },
  { id: 'Mic 3 Gain', label: 'Mic 3', min: -100, max: 20 },
  { id: 'Mic 4 Gain', label: 'Mic 4', min: -100, max: 20 },
  { id: 'Music Gain', label: 'Music', min: -100, max: 20 },
  { id: 'All Hands Gain', label: 'All Hands', min: -100, max: 20 },
  { id: 'Zoom Gain', label: 'Zoom', min: -100, max: 20 },
];

const OUTPUT_GAINS: Array<{ id: string; label: string; min: number; max: number }> = [
  { id: 'Center Speakers Gain', label: 'Center SPK', min: -50, max: 0 },
  { id: 'Outside Speakers Gain', label: 'Outside SPK', min: -100, max: 20 },
];

interface GainStripProps {
  id: string;
  label: string;
  min: number;
  max: number;
  state: CoreState;
  setControl: (component: string, name: string, value: number | boolean) => void;
}

function GainStrip({ id, label, min, max, state, setControl }: GainStripProps) {
  const comp = state[id] ?? {};
  const rawValue = comp['gain']?.value;
  const value = typeof rawValue === 'number' ? rawValue : 0;
  const muted = comp['mute']?.value === true || comp['mute']?.value === 1;
  const bypassed = comp['bypass']?.value === true || comp['bypass']?.value === 1;

  return (
    <div className={`flex flex-col items-center ${bypassed ? 'opacity-50' : ''}`}>
      <Fader
        label={label}
        value={value}
        min={min}
        max={max}
        muted={muted}
        onValueChange={(v) => setControl(id, 'gain', v)}
        onMuteToggle={() => setControl(id, 'mute', !muted)}
      />
      {bypassed && (
        <span className="mt-1 text-label font-medium text-faire-warning-text">Bypass</span>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  blocks: typeof SOURCE_GAINS;
  state: CoreState;
  setControl: (component: string, name: string, value: number | boolean) => void;
}

function GainSection({ title, subtitle, blocks, state, setControl }: SectionProps) {
  return (
    <div className="faire-panel w-fit max-w-full">
      <div className="border-b border-faire-border pb-4">
        <h2 className="faire-heading-section">{title}</h2>
        {subtitle && <p className="mt-1 text-body text-faire-subdued">{subtitle}</p>}
      </div>
      <div className="mt-6 flex flex-wrap gap-8">
        {blocks.map((b) => (
          <GainStrip key={b.id} {...b} state={state} setControl={setControl} />
        ))}
      </div>
    </div>
  );
}

export function GainsPanel({ state, setControl }: GainsPanelProps) {
  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="mb-6">
          <h2 className="faire-heading-section">Sources</h2>
          <p className="mt-1 max-w-2xl text-body text-faire-subdued">
            Mics, music, program, and Zoom send — inline trims after the Dante receiver.
          </p>
        </div>
        <GainSection title="Input / mix sources" blocks={SOURCE_GAINS} state={state} setControl={setControl} />
      </section>

      <section>
        <div className="mb-6">
          <h2 className="faire-heading-section">Speaker zones</h2>
          <p className="mt-1 max-w-2xl text-body text-faire-subdued">
            Trims before room outputs. Center is −50…0 dB; Outside is full range.
          </p>
        </div>
        <GainSection title="Outputs" blocks={OUTPUT_GAINS} state={state} setControl={setControl} />
      </section>
    </div>
  );
}
