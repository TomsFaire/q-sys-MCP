/**
 * useCoreSocket — manages the WebSocket connection to the backend.
 * Returns a send function and emits parsed ServerMessages via callback.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { ServerMessage, ClientMessage } from '../types.js';

const WS_URL = `ws://${window.location.host}/ws`;
const RECONNECT_MS = 2_000;

type MessageHandler = (msg: ServerMessage) => void;

export function useCoreSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destroyedRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (destroyedRef.current) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[ws] connected');
    };

    ws.onmessage = (e) => {
      try {
        const msg: ServerMessage = JSON.parse(e.data);
        onMessageRef.current(msg);
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      /* close will fire next */
    };

    ws.onclose = () => {
      if (!destroyedRef.current) {
        console.log(`[ws] disconnected — retrying in ${RECONNECT_MS}ms`);
        timerRef.current = setTimeout(connect, RECONNECT_MS);
      }
    };
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    destroyedRef.current = false;
    connect();
    return () => {
      destroyedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return send;
}
