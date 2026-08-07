'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

function formatTimestamp(value) {
  if (!value) return '-';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(ms)) return '-';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function MetadataRow({ label, value, mono = false }) {
  return (
    <div className="grid grid-cols-3 gap-4 text-sm py-1.5 border-b border-[color:var(--border-color)]/40 last:border-b-0">
      <dt className="text-[color:var(--text-muted)]">{label}</dt>
      <dd className={`col-span-2 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value || '-'}</dd>
    </div>
  );
}

function JsonBlock({ title, value }) {
  return (
    <section className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <pre className="text-xs font-mono whitespace-pre-wrap break-all text-[color:var(--text-primary)]">
{JSON.stringify(value || {}, null, 2)}
      </pre>
    </section>
  );
}

function CallCard({ call, t }) {
  return (
    <li className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--surface-elevated)]/20 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{call.server}</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            call.present
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-[color:var(--border-color)] text-[color:var(--text-muted)]'
          }`}
        >
          {call.present ? t('present') : t('missing')}
        </span>
      </div>
      {call.role && <div className="text-xs text-[color:var(--text-muted)] mt-1">{call.role}</div>}
      {Array.isArray(call.tools) && call.tools.length > 0 && (
        <div className="text-xs text-[color:var(--text-muted)] mt-2 font-mono">
          {call.tools.join(', ')}
        </div>
      )}
    </li>
  );
}

export default function ConnectedServiceDetailPage({ params }) {
  const { ref } = use(params);
  const refDecoded = decodeURIComponent(ref);
  const t = useTranslations('mcpSkills');

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await fetch(`/api/connected-services/${ref}`);
      if (res.status === 404) {
        setService(null);
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setService(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="min-h-[calc(100vh-66px)] p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          href="/mcp-skills"
          className="inline-flex items-center text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
        >
          ← {t('backToList')}
        </Link>

        {loading && !service && <p className="text-sm text-[color:var(--text-muted)]">{t('loading')}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {notFound && (
          <div className="rounded-xl border border-dashed border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-12 text-center text-[color:var(--text-muted)]">
            {t('notFound')}
          </div>
        )}

        {service && (
          <>
            <header className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold">{service.name}</h1>
                <p className="text-xs text-[color:var(--text-muted)] font-mono mt-1 break-all">
                  {refDecoded}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/mcp-skills/${encodeURIComponent(service.ref)}/graph`}
                  className="rounded-lg px-3 py-2 border border-[color:var(--border-color)] text-sm hover:bg-[color:var(--surface-elevated)]/40"
                >
                  {t('viewGraph')}
                </Link>
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
                <MetadataRow label={t('detail.name')} value={service.name} />
                <MetadataRow label={t('detail.ref')} value={service.ref} mono />
                <MetadataRow label={t('detail.kind')} value={service.kind} />
                <MetadataRow label={t('detail.form')} value={service.form} />
                <MetadataRow
                  label={t('detail.updated')}
                  value={formatTimestamp(service.mirroredAt || service.materializedAt)}
                  mono
                />
                {service.provenance?.hostPath && (
                  <MetadataRow label={t('detail.hostPath')} value={service.provenance.hostPath} mono />
                )}
                {service.provenance?.catalystId && (
                  <MetadataRow label={t('detail.catalyst')} value={service.provenance.catalystId} mono />
                )}
                {service.provenance?.compositionRef && (
                  <MetadataRow label={t('detail.composition')} value={service.provenance.compositionRef} mono />
                )}
              </dl>
            </section>

            <section className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4">
              <h2 className="text-lg font-semibold mb-3">{t('detail.calls')}</h2>
              {(service.calls || []).length === 0 ? (
                <p className="text-sm text-[color:var(--text-muted)]">{t('detail.noCalls')}</p>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {service.calls.map((call, i) => (
                    <CallCard key={`${call.server}-${i}`} call={call} t={t} />
                  ))}
                </ul>
              )}
            </section>

            {service.needs?.length > 0 && <JsonBlock title={t('detail.needs')} value={service.needs} />}
            {service.components?.length > 0 && <JsonBlock title={t('detail.components')} value={service.components} />}
            {service.knobs && Object.keys(service.knobs).length > 0 && (
              <JsonBlock title={t('detail.knobs')} value={service.knobs} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
