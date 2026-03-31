/**
 * ChangeGroupManager — discovers components on the Core, registers a ChangeGroup,
 * polls at 350ms, emits layout + snapshot + update events.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { CoreBridge } from './core-bridge';
import { discoverCoreLayout } from './discover-layout';
import type { CoreState, ControlValue, UiLayout } from './types';

const POLL_INTERVAL_MS = 350;

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
  private tracked: Record<string, string[]> = {};
  private layout: UiLayout | null = null;

  constructor(bridge: CoreBridge) {
    super();
    this.bridge = bridge;
    this.groupId = uuidv4();
  }

  getState(): CoreState {
    return this.state;
  }

  getLayout(): UiLayout | null {
    return this.layout;
  }

  async start() {
    this._stopPolling();
    this.groupId = uuidv4();

    const { tracked, layout } = await discoverCoreLayout(this.bridge);
    this.tracked = tracked;
    this.layout = layout;

    console.log(
      `[cg] discovered: ${layout.gains.length} gain(s), ${layout.mixers.length} mixer(s), ${layout.eqs.length} EQ(s) — design "${layout.designName}"`,
    );

    this.emit('layout', layout);

    await this._buildSnapshot();
    if (Object.keys(this.tracked).length === 0) {
      console.warn('[cg] no audio components discovered — check Script Access on gain / mixer / EQ blocks');
      return;
    }
    await this._registerChangeGroup();
    this._startPolling();
  }

  stop() {
    this._stopPolling();
    this.bridge.call('ChangeGroup.Destroy', { Id: this.groupId }).catch(() => {});
  }

  // ---------------------------------------------------------------------------

  private async _buildSnapshot() {
    const snap: CoreState = {};
    for (const [compName, controlNames] of Object.entries(this.tracked)) {
      try {
        const result = (await this.bridge.call('Component.GetControls', { Name: compName })) as {
          Controls: Array<{ Name: string; Value: unknown; String: string }>;
        };
        const controls: Record<string, ControlValue> = {};
        for (const c of result.Controls) {
          if (controlNames.includes(c.Name)) {
            controls[c.Name] = { value: c.Value as number | boolean | null, string: c.String };
          }
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
    for (const [compName, controlNames] of Object.entries(this.tracked)) {
      try {
        await this.bridge.call('ChangeGroup.AddComponentControl', {
          Id: this.groupId,
          Component: {
            Name: compName,
            Controls: controlNames.map((n) => ({ Name: n })),
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
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async _poll() {
    try {
      const result = (await this.bridge.call('ChangeGroup.Poll', { Id: this.groupId })) as PollResult;
      if (!result.Changes?.length) return;

      const changes = result.Changes.map((c) => ({
        component: c.Component,
        name: c.Name,
        value: c.Value,
        string: c.String,
      }));

      for (const ch of changes) {
        if (!this.state[ch.component]) this.state[ch.component] = {};
        this.state[ch.component][ch.name] = { value: ch.value, string: ch.string };
      }

      this.emit('update', changes);
    } catch {
      /* disconnected */
    }
  }
}
