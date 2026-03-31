import { useState } from 'react';
import { useCoreState } from './hooks/useCoreState.js';
import { GainsPanel } from './panels/GainsPanel.js';
import { MatrixPanel } from './panels/MatrixPanel.js';
import { EQPanel } from './panels/EQPanel.js';

type Tab = 'gains' | 'matrix' | 'eq';

const TABS: { id: Tab; label: string }[] = [
  { id: 'gains', label: 'Gains' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'eq', label: 'EQ' },
];

function formatCoreLabel(host: string, port: number) {
  if (!host) return '';
  return port === 443 ? host : `${host}:${port}`;
}

function StatusPill({ status, host, port }: { status: string; host: string; port: number }) {
  const connecting = status === 'connecting';
  const ok = status === 'connected';

  const label = ok ? formatCoreLabel(host, port) : '';

  return (
    <div
      className={`
        inline-flex items-center gap-2 rounded-faire-sm border px-3 py-1.5 text-label font-medium
        ${ok
          ? 'border-faire-success-border bg-faire-success-surface text-faire-success-text'
          : connecting
            ? 'border-faire-warning-border bg-faire-warning-surface text-faire-warning-text'
            : 'border-faire-error-border bg-faire-error-surface text-faire-error-text'
        }
      `}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          ok ? 'bg-faire-success-text' : connecting ? 'bg-faire-warning-text' : 'bg-faire-error-text'
        } ${connecting ? 'animate-pulse' : ''}`}
        aria-hidden
      />
      <span>
        {ok
          ? `Core · ${label}`
          : connecting
            ? 'Connecting…'
            : 'Disconnected'}
      </span>
    </div>
  );
}

function ConnectPanel(props: {
  host: string;
  port: number;
  onHostChange: (v: string) => void;
  onPortChange: (v: number) => void;
  onConnect: () => void;
  onCancel: () => void;
  error: string;
}) {
  const { host, port, onHostChange, onPortChange, onConnect, onCancel, error } = props;
  const hasError = Boolean(error);

  return (
    <div className="faire-panel mx-auto max-w-md">
      <h2 className="text-section font-medium text-faire-text">Connect to Core</h2>
      <p className="mt-1 text-body text-faire-subdued">
        Enter the Q-Sys Core hostname or IP. WebSocket QRC uses HTTPS port (often 443).
      </p>
      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-faire-text">Host</span>
          <input
            type="text"
            className="faire-input"
            placeholder="10.0.0.50"
            value={host}
            onChange={(e) => onHostChange(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-faire-text">WebSocket port</span>
          <input
            type="number"
            className="faire-input"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => onPortChange(parseInt(e.target.value, 10) || 443)}
          />
        </label>
        {error && (
          <p className="text-body text-faire-error-text" role="alert">
            {error}
          </p>
        )}
        {hasError ? (
          <div className="flex flex-wrap gap-3">
            <button type="button" className="faire-btn-primary min-w-[7rem] flex-1" onClick={onConnect} disabled={!host.trim()}>
              Reconnect
            </button>
            <button type="button" className="faire-btn-ghost min-w-[7rem] flex-1" onClick={onCancel}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="faire-btn-primary mt-1" onClick={onConnect} disabled={!host.trim()}>
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('gains');
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState(443);

  const {
    state,
    layout,
    status,
    coreHost,
    corePort,
    disconnectReason,
    setControl,
    connectCore,
    disconnectCore,
    dismissConnectionError,
  } = useCoreState();

  const hasContent = layout !== null || Object.keys(state).length > 0;
  const showSpinner = status === 'connecting' && !hasContent;
  const needsConnectForm = status === 'disconnected' && !coreHost && !disconnectReason.includes('Connecting');
  const showOfflineBanner =
    status === 'disconnected' && coreHost && !disconnectReason.includes('No Core configured');

  const connectFormError =
    disconnectReason &&
    !disconnectReason.includes('No Core configured') &&
    disconnectReason !== 'Disconnected by user'
      ? disconnectReason
      : '';

  return (
    <div className="flex min-h-screen flex-col bg-faire-page text-faire-text">
      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center border-b border-faire-border bg-faire-card">
        <div className="mx-auto flex w-full max-w-page items-center justify-between gap-8 px-12">
          <div className="flex min-w-0 flex-1 items-center gap-10">
            <div className="min-w-0 shrink-0">
              <h1 className="faire-heading-page">Q-Sys Control</h1>
              {layout?.designName && (
                <p className="mt-0.5 truncate text-label text-faire-subdued" title={layout.designName}>
                  {layout.designName}
                  {layout.platform ? ` · ${layout.platform}` : ''}
                </p>
              )}
            </div>
            <nav className="flex gap-6" role="tablist" aria-label="Panels">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`faire-tab ${activeTab === t.id ? 'faire-tab--active' : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {status === 'connected' && (
              <button type="button" className="faire-btn-ghost text-label" onClick={disconnectCore}>
                Disconnect Core
              </button>
            )}
            <StatusPill status={status} host={coreHost} port={corePort} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-content flex-1 overflow-auto px-12 py-10">
        {showSpinner && (
          <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-4 text-faire-subdued">
            <div className="faire-spinner" role="status" aria-label="Loading" />
            <p className="text-body">Connecting to Core…</p>
            <button
              type="button"
              className="faire-btn-ghost text-label"
              onClick={() => {
                disconnectCore();
                dismissConnectionError();
              }}
            >
              Cancel
            </button>
          </div>
        )}
        {needsConnectForm && (
          <ConnectPanel
            host={formHost}
            port={formPort}
            onHostChange={setFormHost}
            onPortChange={setFormPort}
            onConnect={() => connectCore(formHost, formPort)}
            onCancel={() => {
              disconnectCore();
              dismissConnectionError();
            }}
            error={connectFormError}
          />
        )}
        {showOfflineBanner && (
          <div className="faire-panel mx-auto max-w-md text-center">
            <p className="text-section font-medium text-faire-error-text">Core offline</p>
            <p className="mt-2 text-body text-faire-subdued">{disconnectReason}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" className="faire-btn-primary min-w-[8rem]" onClick={() => connectCore(coreHost, corePort)}>
                Reconnect
              </button>
              <button
                type="button"
                className="faire-btn-ghost min-w-[8rem]"
                onClick={() => {
                  disconnectCore();
                  dismissConnectionError();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {hasContent && (
          <>
            {activeTab === 'gains' && <GainsPanel state={state} layout={layout} setControl={setControl} />}
            {activeTab === 'matrix' && <MatrixPanel state={state} layout={layout} setControl={setControl} />}
            {activeTab === 'eq' && <EQPanel state={state} layout={layout} setControl={setControl} />}
          </>
        )}
      </main>
    </div>
  );
}
