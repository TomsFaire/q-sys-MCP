/**
 * useCoreState — global reactive state for all Q-Sys component controls.
 * Connects to the backend WS, builds/updates a CoreState map, receives
 * dynamic UiLayout from the server, and exposes setControl helpers.
 */

import { useState, useCallback } from 'react';
import { useCoreSocket } from './useCoreSocket.js';
import type { CoreState, ClientMessage, ServerMessage, UiLayout } from '../types.js';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface CoreStateResult {
  state: CoreState;
  layout: UiLayout | null;
  status: ConnectionStatus;
  coreHost: string;
  corePort: number;
  disconnectReason: string;
  setControl: (component: string, name: string, value: number | boolean) => void;
  setControls: (component: string, controls: Array<{ name: string; value: number | boolean }>) => void;
  connectCore: (host: string, wsPort?: number) => void;
  disconnectCore: () => void;
  /** Clear error text locally; use after a failed connect or with cancel. */
  dismissConnectionError: () => void;
}

function isServerMessage(x: unknown): x is ServerMessage {
  return typeof x === 'object' && x !== null && 'type' in x;
}

export function useCoreState(): CoreStateResult {
  const [state, setState] = useState<CoreState>({});
  const [layout, setLayout] = useState<UiLayout | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [coreHost, setCoreHost] = useState('');
  const [corePort, setCorePort] = useState(443);
  const [disconnectReason, setDisconnectReason] = useState('');

  const handleMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === 'layout') {
      setLayout(msg.layout);
      setStatus('connected');
    } else if (msg.type === 'snapshot') {
      setState(msg.state);
      setStatus('connected');
    } else if (msg.type === 'update') {
      setState((prev) => {
        const next = { ...prev };
        for (const ch of msg.changes) {
          next[ch.component] = {
            ...next[ch.component],
            [ch.name]: { value: ch.value, string: ch.string },
          };
        }
        return next;
      });
    } else if (msg.type === 'core_session') {
      setCorePort(msg.port);
      setCoreHost(msg.host ?? '');
      if (msg.connected) {
        setDisconnectReason('');
        setStatus('connected');
      } else if (msg.host) {
        setDisconnectReason('');
        setStatus('connecting');
      } else {
        setStatus('disconnected');
        /* keep disconnectReason — e.g. Connect failed after disconnected + core_session */
      }
    } else if (msg.type === 'connected') {
      setCoreHost(msg.coreHost);
      setCorePort(msg.corePort);
      setDisconnectReason('');
      setStatus('connected');
    } else if (msg.type === 'disconnected') {
      setDisconnectReason(msg.reason);
      setStatus('disconnected');
      if (!msg.reason.includes('Connecting')) {
        setLayout(null);
        setState({});
      }
    }
  }, []);

  const send = useCoreSocket((raw) => {
    if (isServerMessage(raw)) handleMessage(raw);
  });

  const connectCore = useCallback(
    (host: string, wsPort?: number) => {
      const msg: ClientMessage = { type: 'connect', host: host.trim(), ...(wsPort !== undefined ? { wsPort } : {}) };
      send(msg);
      setStatus('connecting');
      setDisconnectReason('');
    },
    [send],
  );

  const disconnectCore = useCallback(() => {
    send({ type: 'disconnect_core' });
  }, [send]);

  const dismissConnectionError = useCallback(() => {
    setDisconnectReason('');
  }, []);

  const setControls = useCallback(
    (component: string, controls: Array<{ name: string; value: number | boolean }>) => {
      const msg: ClientMessage = { type: 'set', component, controls };
      send(msg);
      setState((prev) => {
        const next = { ...prev };
        const comp = { ...next[component] };
        for (const c of controls) {
          comp[c.name] = { value: c.value, string: String(c.value) };
        }
        next[component] = comp;
        return next;
      });
    },
    [send],
  );

  const setControl = useCallback(
    (component: string, name: string, value: number | boolean) => {
      setControls(component, [{ name, value }]);
    },
    [setControls],
  );

  return {
    state,
    layout,
    status,
    coreHost,
    corePort,
    disconnectReason,
    setControl,
    setControls,
    connectCore,
    disconnectCore,
    dismissConnectionError,
  };
}
