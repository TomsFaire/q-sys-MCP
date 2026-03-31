// Shared types for the frontend (mirrors backend types.ts)

export interface ControlValue {
  value: number | boolean | null;
  string: string;
}

export type ComponentState = Record<string, ControlValue>;
export type CoreState = Record<string, ComponentState>;

export interface GainChannelInfo {
  gainKey: string;
  muteKey: string;
  label: string;
}

export interface GainBlockInfo {
  name: string;
  channels: GainChannelInfo[];
  gainMin: number;
  gainMax: number;
}

export interface MixerLayoutInfo {
  name: string;
  inputCount: number;
  outputCount: number;
  inputLabels: string[];
  outputLabels: string[];
}

export interface EqLayoutInfo {
  name: string;
  bandCount: number;
}

export interface UiLayout {
  designName: string;
  platform: string;
  gains: GainBlockInfo[];
  mixers: MixerLayoutInfo[];
  eqs: EqLayoutInfo[];
}

export type ServerMessage =
  | { type: 'snapshot'; state: CoreState }
  | { type: 'layout'; layout: UiLayout }
  | { type: 'update'; changes: Array<{ component: string; name: string; value: number | boolean | null; string: string }> }
  | { type: 'connected'; coreHost: string; corePort: number }
  | { type: 'disconnected'; reason: string }
  | { type: 'core_session'; host: string | null; port: number; connected: boolean };

export type ClientMessage =
  | { type: 'set'; component: string; controls: Array<{ name: string; value: number | boolean }> }
  | { type: 'connect'; host: string; wsPort?: number }
  | { type: 'disconnect_core' };
