// Shared types between backend modules and the browser protocol

export interface ControlValue {
  value: number | boolean | null;
  string: string;
}

// Component name → control name → value
export type ComponentState = Record<string, ControlValue>;
export type CoreState = Record<string, ComponentState>;

// Messages sent from backend → browser
export type ServerMessage =
  | { type: 'snapshot'; state: CoreState }
  | { type: 'update'; changes: Array<{ component: string; name: string; value: number | boolean | null; string: string }> }
  | { type: 'connected'; coreHost: string }
  | { type: 'disconnected'; reason: string };

// Messages sent from browser → backend
export type ClientMessage =
  | { type: 'set'; component: string; controls: Array<{ name: string; value: number | boolean }> };

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
