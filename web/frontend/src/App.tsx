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

function StatusPill({ status, host }: { status: string; host: string }) {
  const connecting = status === 'connecting';
  const ok = status === 'connected';

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
          ? `Core · ${host}`
          : connecting
            ? 'Connecting…'
            : 'Disconnected'}
      </span>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('gains');
  const { state, status, coreHost, setControl } = useCoreState();

  return (
    <div className="flex min-h-screen flex-col bg-faire-page text-faire-text">
      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center border-b border-faire-border bg-faire-card">
        <div className="mx-auto flex w-full max-w-page items-center justify-between gap-8 px-12">
          <div className="flex min-w-0 flex-1 items-center gap-10">
            <h1 className="faire-heading-page shrink-0">Q-Sys Control</h1>
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
          <StatusPill status={status} host={coreHost} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-content flex-1 overflow-auto px-12 py-10">
        {status === 'connecting' && Object.keys(state).length === 0 && (
          <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-faire-subdued">
            <div className="faire-spinner" role="status" aria-label="Loading" />
            <p className="text-body">Connecting to Core…</p>
          </div>
        )}
        {status === 'disconnected' && Object.keys(state).length === 0 && (
          <div className="faire-panel mx-auto max-w-md text-center">
            <p className="text-section font-medium text-faire-error-text">Core offline</p>
            <p className="mt-2 text-body text-faire-subdued">The backend will reconnect automatically.</p>
          </div>
        )}
        {(status === 'connected' || Object.keys(state).length > 0) && (
          <>
            {activeTab === 'gains' && <GainsPanel state={state} setControl={setControl} />}
            {activeTab === 'matrix' && <MatrixPanel state={state} setControl={setControl} />}
            {activeTab === 'eq' && <EQPanel state={state} setControl={setControl} />}
          </>
        )}
      </main>
    </div>
  );
}
