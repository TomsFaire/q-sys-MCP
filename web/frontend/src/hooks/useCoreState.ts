/**
 * useCoreState — global reactive state for all Q-Sys component controls.
 * Connects to the backend WS, builds/updates a CoreState map, and exposes
 * a helper to send Component.Set commands.
 */

import { useState, useCallback } from 'react';
import { useCoreSocket } from './useCoreSocket.js';
import type { CoreState, ClientMessage } from '../types.js';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface CoreStateResult {
  state: CoreState;
  status: ConnectionStatus;
  coreHost: string;
  setControl: (component: string, name: string, value: number | boolean) => void;
  setControls: (component: string, controls: Array<{ name: string; value: number | boolean }>) => void;
}

export function useCoreState(): CoreStateResult {
  const [state, setState] = useState<CoreState>({});
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [coreHost, setCoreHost] = useState('');

  const handleMessage = useCallback((msg: ReturnType<typeof JSON.parse>) => {
    if (msg.type === 'snapshot') {
      setState(msg.state as CoreState);
      setStatus('connected');
    } else if (msg.type === 'update') {
      setState(prev => {
        const next = { ...prev };
        for (const ch of msg.changes) {
          next[ch.component] = {
            ...next[ch.component],
            [ch.name]: { value: ch.value, string: ch.string },
          };
        }
        return next;
      });
    } else if (msg.type === 'connected') {
      setCoreHost(msg.coreHost);
      setStatus('connected');
    } else if (msg.type === 'disconnected') {
      setStatus('disconnected');
    }
  }, []);

  const send = useCoreSocket(handleMessage);

  const setControls = useCallback((
    component: string,
    controls: Array<{ name: string; value: number | boolean }>,
  ) => {
    const msg: ClientMessage = { type: 'set', component, controls };
    send(msg);
    // Optimistic update
    setState(prev => {
      const next = { ...prev };
      const comp = { ...next[component] };
      for (const c of controls) {
        comp[c.name] = { value: c.value, string: String(c.value) };
      }
      next[component] = comp;
      return next;
    });
  }, [send]);

  const setControl = useCallback((component: string, name: string, value: number | boolean) => {
    setControls(component, [{ name, value }]);
  }, [setControls]);

  return { state, status, coreHost, setControl, setControls };
}
