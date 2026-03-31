/**
 * discover-layout — inspect Component.GetComponents + GetControls and build
 * a UI layout + ChangeGroup control list for any Q-Sys design.
 */

import type { CoreBridge } from './core-bridge';
import type {
  GainBlockInfo,
  GainChannelInfo,
  EqLayoutInfo,
  MixerLayoutInfo,
  UiLayout,
} from './types';

/** Component types we expose in the web UI (exclude plugins, scripts, UCI, etc.) */
const TRACKED_TYPES = new Set(['gain', 'mixer', 'equalizer_parametric']);

type RawControl = { Name: string; String?: string; ValueMin?: number; ValueMax?: number };

function parseMixerLayout(controls: RawControl[]): Omit<MixerLayoutInfo, 'name'> {
  let maxIn = 0;
  let maxOut = 0;
  const re = /^input\.(\d+)\.output\.(\d+)\.(gain|mute)$/;
  for (const c of controls) {
    const m = c.Name.match(re);
    if (m) {
      maxIn = Math.max(maxIn, parseInt(m[1], 10));
      maxOut = Math.max(maxOut, parseInt(m[2], 10));
    }
  }

  const inputLabels: string[] = [];
  for (let i = 1; i <= maxIn; i++) {
    const labelC = controls.find((x) => x.Name === `input.${i}.label`);
    inputLabels.push((labelC?.String ?? '').trim() || `Input ${i}`);
  }
  const outputLabels: string[] = [];
  for (let o = 1; o <= maxOut; o++) {
    const labelC = controls.find((x) => x.Name === `output.${o}.label`);
    outputLabels.push((labelC?.String ?? '').trim() || `Out ${o}`);
  }

  return {
    inputCount: maxIn,
    outputCount: maxOut,
    inputLabels,
    outputLabels,
  };
}

function parseGainChannels(controls: RawControl[]): GainChannelInfo[] {
  const hasSingle = controls.some((c) => c.Name === 'gain');
  if (hasSingle) {
    return [{ gainKey: 'gain', muteKey: 'mute', label: 'Gain' }];
  }
  const nums = new Set<number>();
  const re = /^gain\.(\d+)$/;
  for (const c of controls) {
    const m = c.Name.match(re);
    if (m) nums.add(parseInt(m[1], 10));
  }
  if (nums.size === 0) {
    return [{ gainKey: 'gain', muteKey: 'mute', label: 'Gain' }];
  }
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted.map((n) => {
    const muteKey = controls.some((c) => c.Name === `mute.${n}`) ? `mute.${n}` : 'mute';
    const labelC =
      controls.find((c) => c.Name === `label.${n}`) ||
      controls.find((c) => c.Name === `ch.${n}.label`);
    return {
      gainKey: `gain.${n}`,
      muteKey,
      label: (labelC?.String ?? '').trim() || `Ch ${n}`,
    };
  });
}

function maxEqBands(controlNames: string[]): number {
  let max = 0;
  const re = /^frequency\.(\d+)$/;
  for (const n of controlNames) {
    const m = n.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export interface DiscoverResult {
  tracked: Record<string, string[]>;
  layout: UiLayout;
}

export async function discoverCoreLayout(bridge: CoreBridge): Promise<DiscoverResult> {
  const st = (await bridge.call('StatusGet', {})) as { DesignName?: string; Platform?: string };
  const designName = st.DesignName ?? '';
  const platform = st.Platform ?? '';

  const raw = (await bridge.call('Component.GetComponents', {})) as Record<string, unknown>;
  const components = Object.values(raw).filter((c): c is { Name: string; Type?: string } => {
    return typeof c === 'object' && c !== null && 'Name' in c && typeof (c as { Name: unknown }).Name === 'string';
  });

  const tracked: Record<string, string[]> = {};
  const gains: GainBlockInfo[] = [];
  const mixers: MixerLayoutInfo[] = [];
  const eqs: EqLayoutInfo[] = [];

  for (const comp of components) {
    const type = (comp.Type ?? '').toLowerCase();
    if (!TRACKED_TYPES.has(type)) continue;

    let result: { Controls: RawControl[] };
    try {
      result = (await bridge.call('Component.GetControls', { Name: comp.Name })) as { Controls: RawControl[] };
    } catch {
      continue;
    }
    const controls = result.Controls ?? [];
    if (controls.length === 0) continue;

    const names = controls.map((c) => c.Name);
    tracked[comp.Name] = names;

    if (type === 'gain') {
      const channels = parseGainChannels(controls);
      const gainCtl = controls.find((c) => c.Name === channels[0]?.gainKey);
      const gmin = typeof gainCtl?.ValueMin === 'number' ? gainCtl.ValueMin : -100;
      const gmax = typeof gainCtl?.ValueMax === 'number' ? gainCtl.ValueMax : 20;
      gains.push({
        name: comp.Name,
        channels,
        gainMin: gmin,
        gainMax: gmax,
      });
    } else if (type === 'mixer') {
      const m = parseMixerLayout(controls);
      if (m.inputCount > 0 && m.outputCount > 0) {
        mixers.push({ name: comp.Name, ...m });
      }
    } else if (type === 'equalizer_parametric') {
      const bands = maxEqBands(names);
      if (bands > 0) {
        eqs.push({ name: comp.Name, bandCount: bands });
      }
    }
  }

  gains.sort((a, b) => a.name.localeCompare(b.name));
  mixers.sort((a, b) => a.name.localeCompare(b.name));
  eqs.sort((a, b) => a.name.localeCompare(b.name));

  return {
    tracked,
    layout: { designName, platform, gains, mixers, eqs },
  };
}
