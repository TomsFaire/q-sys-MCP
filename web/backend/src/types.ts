// Shared types between backend modules and the browser protocol

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

// Messages sent from backend → browser
export type ServerMessage =
  | { type: 'snapshot'; state: CoreState }
  | { type: 'layout'; layout: UiLayout }
  | { type: 'update'; changes: Array<{ component: string; name: string; value: number | boolean | null; string: string }> }
  | { type: 'connected'; coreHost: string; corePort: number }
  | { type: 'disconnected'; reason: string }
  /** Sent when the browser connects so the UI can show host/port fields */
  | { type: 'core_session'; host: string | null; port: number; connected: boolean };

// Messages sent from browser → backend
export type ClientMessage =
  | { type: 'set'; component: string; controls: Array<{ name: string; value: number | boolean }> }
  | { type: 'connect'; host: string; wsPort?: number }
  | { type: 'disconnect_core' };

export interface QrcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

export interface QrcResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
  method?: string;
  params?: unknown;
}
