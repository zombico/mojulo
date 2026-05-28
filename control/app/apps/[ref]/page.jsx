'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const REFRESH_INTERVAL_MS = 10_000;

function StatusPill({ status, t }) {
  const palette = {
    running: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    crashed: 'bg-red-500/15 text-red-300 border-red-500/40',
    stopped: 'bg-[color:var(--surface-elevated)]/40 text-[color:var(--text-muted)] border-[color:var(--border-color)]',
    unknown: 'bg-[color:var(--surface-elevated)]/40 text-[color:var(--text-muted)] border-[color:var(--border-color)]',
  };
  const cls = palette[status] || palette.unknown;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {t(`status.${status}`)}
    </span>
  );
}

function MetadataRow({ label, value, mono = false }) {
  return (
    <div className="grid grid-cols-3 gap-4 text-sm py-1.5 border-b border-[color:var(--border-color)]/40 last:border-b-0">
      <dt className="text-[color:var(--text-muted)]">{label}</dt>
      <dd className={`col-span-2 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value || '—'}</dd>
    </div>
  );
}

function BindingCard({ title, data }) {
  return (
    <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--surface-elevated)]/20 p-3">
      <div className="text-xs uppercase text-[color:var(--text-muted)] mb-1">{title}</div>
      {data ? (
        <pre className="text-xs font-mono whitespace-pre-wrap break-all text-[color:var(--text-primary)]">
{JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <div className="text-xs text-[color:var(--text-muted)]">—</div>
      )}
    </div>
  );
}

function McpPanel({ refEncoded, runtime, t }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!runtime) {
      setData(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/apps/${refEncoded}/describe`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      if (body.offline) {
        setData(null);
      } else {
        setData(body);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [refEncoded, runtime]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4 space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('detail.mcpPanel.title')}</h2>
        {runtime?.mcpUrl && (
          <a
            href={runtime.mcpUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline text-[color:var(--brand-teal)]"
          >
            {t('openMcp')}
          </a>
        )}
      </header>
      {!runtime ? (
        <p className="text-sm text-[color:var(--text-muted)]">{t('detail.mcpPanel.offline')}</p>
      ) : (
        <>
          <MetadataRow label={t('detail.mcpPanel.url')} value={runtime.mcpUrl} mono />
          {loading && <p className="text-xs text-[color:var(--text-muted)]">{t('detail.mcpPanel.loading')}</p>}
          {error && (
            <p className="text-xs text-red-400">
              {t('detail.mcpPanel.error', { error })}
            </p>
          )}
          {data && (
            <>
              {data.declared_purpose && (
                <MetadataRow
                  label={t('detail.mcpPanel.declaredPurpose')}
                  value={data.declared_purpose}
                />
              )}
              <div>
                <div className="text-xs uppercase text-[color:var(--text-muted)] mb-2">
                  {t('detail.mcpPanel.registeredTools')}
                </div>
                {(!data.registered_tools || data.registered_tools.length === 0) ? (
                  <p className="text-xs text-[color:var(--text-muted)]">{t('detail.mcpPanel.noTools')}</p>
                ) : (
                  <ul className="space-y-1">
                    {data.registered_tools.map((tool) => (
                      <li
                        key={tool.name}
                        className="rounded border border-[color:var(--border-color)]/60 bg-[color:var(--surface-elevated)]/20 px-3 py-2"
                      >
                        <div className="font-mono text-xs">{tool.name}</div>
                        {tool.description && (
                          <div className="text-xs text-[color:var(--text-muted)] mt-0.5">
                            {tool.description}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function EnvPanel({ refEncoded, t }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/apps/${refEncoded}/env`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      setKeys(body.keys || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [refEncoded]);

  useEffect(() => {
    load();
  }, [load]);

  async function addOrUpdate(key, value) {
    setError('');
    const res = await fetch(`/api/apps/${refEncoded}/env`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
  }

  async function onAdd(e) {
    e.preventDefault();
    if (!newKey) return;
    try {
      await addOrUpdate(newKey, newValue);
      setNewKey('');
      setNewValue('');
      await load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function onSaveEdit(key) {
    try {
      await addOrUpdate(key, editValue);
      setEditing(null);
      setEditValue('');
      await load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function onDelete(key) {
    if (!confirm(t('detail.envPanel.deleteConfirm', { key }))) return;
    try {
      const res = await fetch(`/api/apps/${refEncoded}/env/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  return (
    <section className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4 space-y-3">
      <header>
        <h2 className="text-lg font-semibold">{t('detail.envPanel.title')}</h2>
        <p className="text-xs text-[color:var(--text-muted)] mt-1">
          {t('detail.envPanel.explainer')}
        </p>
      </header>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <form onSubmit={onAdd} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-end">
        <label className="block text-xs">
          <span className="text-[color:var(--text-muted)]">{t('detail.envPanel.addKey')}</span>
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder={t('detail.envPanel.newKeyPlaceholder')}
            className="mt-1 w-full rounded-md border border-[color:var(--border-color)] bg-[color:var(--surface-elevated)]/40 px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block text-xs">
          <span className="text-[color:var(--text-muted)]">{t('detail.envPanel.addValue')}</span>
          <input
            type="password"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={t('detail.envPanel.newValuePlaceholder')}
            className="mt-1 w-full rounded-md border border-[color:var(--border-color)] bg-[color:var(--surface-elevated)]/40 px-3 py-2 text-sm font-mono"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          disabled={!newKey}
          className="rounded-lg px-4 py-2 bg-[color:var(--brand-teal)] text-[color:var(--brand-navy)] font-semibold text-sm disabled:opacity-50"
        >
          {t('detail.envPanel.add')}
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-[color:var(--text-muted)]">{t('loading')}</p>
      ) : keys.length === 0 ? (
        <p className="text-xs text-[color:var(--text-muted)]">{t('detail.envPanel.noKeys')}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border-color)]/40">
          {keys.map((key) => (
            <li key={key} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="font-mono text-xs">{key}</span>
              {editing === key ? (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="rounded-md border border-[color:var(--border-color)] bg-[color:var(--surface-elevated)]/40 px-2 py-1 text-xs font-mono"
                    autoComplete="off"
                    placeholder={t('detail.envPanel.newValuePlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => onSaveEdit(key)}
                    className="rounded-md bg-[color:var(--brand-teal)] text-[color:var(--brand-navy)] font-semibold px-2 py-1 text-xs"
                  >
                    {t('detail.envPanel.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setEditValue('');
                    }}
                    className="rounded-md border border-[color:var(--border-color)] px-2 py-1 text-xs"
                  >
                    {t('detail.envPanel.cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[color:var(--text-muted)]">
                    {t('detail.envPanel.valueHidden')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(key);
                      setEditValue('');
                    }}
                    className="rounded-md border border-[color:var(--border-color)] px-2 py-1 text-xs"
                  >
                    {t('detail.envPanel.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(key)}
                    className="rounded-md border border-red-500/40 text-red-300 px-2 py-1 text-xs"
                  >
                    {t('detail.envPanel.delete')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProvenancePanel({ principles, t }) {
  return (
    <section className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4 space-y-3">
      <header>
        <h2 className="text-lg font-semibold">{t('detail.provenance.title')}</h2>
        <p className="text-xs text-[color:var(--text-muted)] mt-1">{t('detail.provenance.subtitle')}</p>
      </header>
      {(!principles || principles.length === 0) ? (
        <p className="text-xs text-[color:var(--text-muted)]">{t('detail.provenance.none')}</p>
      ) : (
        <ul className="space-y-2">
          {principles.map((p) => (
            <li
              key={p.id}
              className="rounded border border-[color:var(--border-color)]/60 bg-[color:var(--surface-elevated)]/20 px-3 py-2"
            >
              <div className="text-xs text-[color:var(--text-muted)] font-mono mb-1">
                {p.sourceEvent}
              </div>
              <pre className="text-xs whitespace-pre-wrap break-words text-[color:var(--text-primary)]">
{p.bodyMd}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatTimestamp(value) {
  if (!value) return '—';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

export default function AppDetailPage({ params }) {
  const { ref } = use(params);
  const refEncoded = ref;
  const refDecoded = decodeURIComponent(ref);
  const t = useTranslations('apps');

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/apps/${refEncoded}`);
      if (res.status === 404) {
        setApp(null);
        setError('');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      setApp(body);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [refEncoded]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-poll while the tab is visible so the status pill and the MCP panel
  // stay reasonably fresh without a websocket. The interval is generous —
  // operators looking for instant feedback can hit refresh.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  async function startApp() {
    setActing(true);
    try {
      const res = await fetch(`/api/apps/${refEncoded}/start`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  }

  async function stopApp() {
    setActing(true);
    try {
      const res = await fetch(`/api/apps/${refEncoded}/stop`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-66px)] p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          href="/apps"
          className="inline-flex items-center text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
        >
          ← {t('backToList')}
        </Link>

        {loading && !app && <p className="text-sm text-[color:var(--text-muted)]">{t('loading')}</p>}

        {!loading && !app && !error && (
          <div className="rounded-xl border border-dashed border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-12 text-center text-[color:var(--text-muted)]">
            {t('notFound')}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {app && (
          <>
            <header className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold">{app.name}</h1>
                  <StatusPill status={app.runtime?.status || 'stopped'} t={t} />
                </div>
                <p className="text-xs text-[color:var(--text-muted)] font-mono mt-1 break-all">
                  {refDecoded}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/apps/${refEncoded}/graph`}
                  className="rounded-lg px-3 py-2 border border-[color:var(--border-color)] text-sm hover:bg-[color:var(--surface-elevated)]/40"
                >
                  {t('detail.viewGraph')}
                </Link>
                {app.runtime?.url && (
                  <a
                    href={app.runtime.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-3 py-2 border border-[color:var(--border-color)] text-sm hover:bg-[color:var(--surface-elevated)]/40"
                  >
                    {t('openPreview')}
                  </a>
                )}
                {app.runtime ? (
                  <button
                    type="button"
                    onClick={stopApp}
                    disabled={acting}
                    className="rounded-lg px-3 py-2 border border-[color:var(--border-color)] text-sm disabled:opacity-50"
                  >
                    {acting ? t('actions.stopping') : t('actions.stop')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startApp}
                    disabled={acting}
                    className="rounded-lg px-4 py-2 bg-[color:var(--brand-teal)] text-[color:var(--brand-navy)] font-semibold text-sm disabled:opacity-50"
                  >
                    {acting ? t('actions.starting') : t('actions.start')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={load}
                  disabled={loading}
                  className="rounded-lg px-3 py-2 border border-[color:var(--border-color)] text-sm disabled:opacity-50"
                >
                  {loading ? t('loading') : t('refresh')}
                </button>
              </div>
            </header>

            <section className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4">
              <h2 className="text-lg font-semibold mb-2">{t('detail.metadata')}</h2>
              <dl>
                <MetadataRow label={t('detail.appName')} value={app.name} />
                <MetadataRow label={t('detail.adapter')} value={app.adapterId} />
                <MetadataRow label={t('detail.host')} value={app.host} />
                <MetadataRow label={t('detail.artifactPath')} value={app.locator} mono />
                <MetadataRow label={t('detail.materializationRef')} value={app.ref} mono />
                <MetadataRow
                  label={t('detail.materializedAt')}
                  value={formatTimestamp(app.materializedAt)}
                  mono
                />
              </dl>
            </section>

            <section className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4">
              <h2 className="text-lg font-semibold mb-3">{t('detail.bindings')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <BindingCard title={t('detail.binding.runner')} data={app.bindings.runner} />
                <BindingCard title={t('detail.binding.durability')} data={app.bindings.durability} />
                <BindingCard title={t('detail.binding.inference')} data={app.bindings.inference} />
                <BindingCard title={t('detail.binding.mcpSelf')} data={app.bindings.mcp_self} />
              </div>
            </section>

            <McpPanel refEncoded={refEncoded} runtime={app.runtime} t={t} />
            <EnvPanel refEncoded={refEncoded} t={t} />
            <ProvenancePanel principles={app.principles} t={t} />
          </>
        )}
      </div>
    </main>
  );
}
