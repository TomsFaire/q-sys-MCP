// Shared types for the frontend (mirrors backend types.ts)

export interface ControlValue {
  value: number | boolean | null;
  string: string;
}

export type ComponentState = Record<string, ControlValue>;
export type CoreState = Record<string, ComponentState>;

export type ServerMessage =
  | { type: 'snapshot'; state: CoreState }
  | { type: 'update'; changes: Array<{ component: string; name: string; value: number | boolean | null; string: string }> }
  | { type: 'connected'; coreHost: string }
  | { type: 'disconnected'; reason: string };

export type ClientMessage =
  | { type: 'set'; component: string; controls: Array<{ name: string; value: number | boolean }> };
