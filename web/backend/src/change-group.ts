/**
 * ChangeGroupManager — registers all UI-relevant controls in a Q-Sys
 * ChangeGroup and polls at 350ms, emitting 'update' events with deltas
 * and 'snapshot' events with the full initial state.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { CoreBridge } from './core-bridge';
import type { CoreState, ControlValue } from './types';

const POLL_INTERVAL_MS = 350;

// Gain block names must match Q-Sys Designer exactly (see Component.GetComponents).
export const TRACKED_COMPONENTS: Record<string, string[]> = {
  'Mic 1 Gain': ['gain', 'mute', 'bypass'],
  'Mic 2 Gain': ['gain', 'mute', 'bypass'],
  'Mic 3 Gain': ['gain', 'mute', 'bypass'],
  'Mic 4 Gain': ['gain', 'mute', 'bypass'],
  'Music Gain': ['gain', 'mute', 'bypass'],
  'All Hands Gain': ['gain', 'mute', 'bypass'],
  'Zoom Gain': ['gain', 'mute', 'bypass'],
  'Center Speakers Gain': ['gain', 'mute', 'bypass'],
  'Outside Speakers Gain': ['gain', 'mute', 'bypass'],

  // Mixer inputs: per-input gain + mute
  Mixer_8x8: [
    ...[1,2,3,4,5,6,7,8,9,10,11,12,13].flatMap(i => [
      `input.${i}.gain`, `input.${i}.mute`, `input.${i}.trim`,
    ]),
    // All crosspoints (13 inputs × 11 outputs)
    ...[1,2,3,4,5,6,7,8,9,10,11,12,13].flatMap(i =>
      [1,2,3,4,5,6,7,8,9,10,11].flatMap(o => [
        `input.${i}.output.${o}.gain`,
        `input.${i}.output.${o}.mute`,
      ])
    ),
    // Outputs
    ...[1,2,3,4,5,6,7,8,9,10,11].flatMap(o => [
      `output.${o}.gain`, `output.${o}.mute`,
    ]),
  ],

  // EQs
  Parametric_Equalizer: [
    'mute', 'bypass', 'master.gain',
    ...[1,2,3,4,5].flatMap(b => [
      `frequency.${b}`, `gain.${b}`, `bandwidth.${b}`, `bypass.${b}`, `type.${b}`,
    ]),
  ],
  Parametric_Equalizer_1: [
    'mute', 'bypass', 'master.gain',
    ...[1,2,3,4].flatMap(b => [
      `frequency.${b}`, `gain.${b}`, `bandwidth.${b}`, `bypass.${b}`, `type.${b}`,
    ]),
  ],
  Parametric_Equalizer_2: [
    'mute', 'bypass', 'master.gain',
    ...[1,2,3,4].flatMap(b => [
      `frequency.${b}`, `gain.${b}`, `bandwidth.${b}`, `bypass.${b}`, `type.${b}`,
    ]),
  ],
  Parametric_Equalizer_3: [
    'mute', 'bypass', 'master.gain',
    ...[1,2,3,4,5,6].flatMap(b => [
      `frequency.${b}`, `gain.${b}`, `bandwidth.${b}`, `bypass.${b}`, `type.${b}`,
    ]),
  ],

  // HPF blocks
  'High-Pass_Filter':   ['frequency', 'slope', 'bypass', 'mute'],
  'High-Pass_Filter_1': ['frequency', 'slope', 'bypass', 'mute'],
  'High-Pass_Filter_3': ['frequency', 'slope', 'bypass', 'mute'],
  'High-Pass_Filter_4': ['frequency', 'slope', 'bypass', 'mute'],

  // Compressor
  Compressor: ['threshold.level', 'ratio', 'attack', 'release', 'output.gain', 'bypass', 'soft.knee'],

  // AMM
  Gating_Automatic_Mic_Mixer: [
    ...[1,2,3,4,5,6,7,8].flatMap(c => [
      `channel.${c}.post.gate.gain`,
      `channel.${c}.post.gate.mute`,
      `channel.${c}.open`,
    ]),
    'config.minimum.snr', 'config.depth', 'config.hold.time', 'config.NOM.maximum',
  ],
};

interface QrcChange {
  Component: string;
  Name: string;
  Value: number | boolean;
  String: string;
}

interface PollResult {
  Id: string;
  Changes: QrcChange[];
}

export class ChangeGroupManager extends EventEmitter {
  private bridge: CoreBridge;
  private groupId: string;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private state: CoreState = {};

  constructor(bridge: CoreBridge) {
    super();
    this.bridge = bridge;
    this.groupId = uuidv4();
  }

  async start() {
    await this._buildSnapshot();
    await this._registerChangeGroup();
    this._startPolling();
  }

  stop() {
    this._stopPolling();
    // Best-effort destroy
    this.bridge.call('ChangeGroup.Destroy', { Id: this.groupId }).catch(() => {});
  }

  getState(): CoreState { return this.state; }

  // ---------------------------------------------------------------------------

  private async _buildSnapshot() {
    const snap: CoreState = {};
    for (const [compName] of Object.entries(TRACKED_COMPONENTS)) {
      try {
        const result = await this.bridge.call('Component.GetControls', { Name: compName }) as { Controls: Array<{ Name: string; Value: unknown; String: string }> };
        const controls: Record<string, ControlValue> = {};
        for (const c of result.Controls) {
          controls[c.Name] = { value: c.Value as number | boolean | null, string: c.String };
        }
        snap[compName] = controls;
      } catch (e) {
        console.warn(`[cg] snapshot failed for ${compName}: ${(e as Error).message}`);
      }
    }
    this.state = snap;
    this.emit('snapshot', snap);
  }

  private async _registerChangeGroup() {
    for (const [compName, controlNames] of Object.entries(TRACKED_COMPONENTS)) {
      try {
        await this.bridge.call('ChangeGroup.AddComponentControl', {
          Id: this.groupId,
          Component: {
            Name: compName,
            Controls: controlNames.map(n => ({ Name: n })),
          },
        });
      } catch (e) {
        console.warn(`[cg] AddComponentControl failed for ${compName}: ${(e as Error).message}`);
      }
    }
    console.log('[cg] change group registered');
  }

  private _startPolling() {
    this.pollTimer = setInterval(() => this._poll(), POLL_INTERVAL_MS);
  }

  private _stopPolling() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  private async _poll() {
    try {
      const result = await this.bridge.call('ChangeGroup.Poll', { Id: this.groupId }) as PollResult;
      if (!result.Changes?.length) return;

      const changes = result.Changes.map(c => ({
        component: c.Component,
        name: c.Name,
        value: c.Value,
        string: c.String,
      }));

      // Update local state
      for (const ch of changes) {
        if (!this.state[ch.component]) this.state[ch.component] = {};
        this.state[ch.component][ch.name] = { value: ch.value, string: ch.string };
      }

      this.emit('update', changes);
    } catch { /* bridge disconnected — poller will be restarted on reconnect */ }
  }
}
