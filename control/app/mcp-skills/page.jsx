'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

function formatTimestamp(value) {
  if (!value) return '-';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(ms)) return '-';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function CountStat({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">{label}</span>
    </div>
  );
}

function CallPill({ call }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
        call.present
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-[color:var(--border-color)] bg-[color:var(--surface-elevated)]/30 text-[color:var(--text-muted)]'
      }`}
    >
      {call.server}{call.role ? ` · ${call.role}` : ''}
    </span>
  );
}

export default function ConnectedServicesPage() {
  const t = useTranslations('mcpSkills');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [services, setServices] = useState([]);
  const [manifest, setManifest] = useState(null);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [servicesRes, graphRes] = await Promise.all([
        fetch('/api/connected-services'),
        fetch('/api/connected-services/graph?framing=mcp-skills'),
      ]);
      if (!servicesRes.ok) {
        const body = await servicesRes.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${servicesRes.status}`);
      }
      if (!graphRes.ok) {
        const body = await graphRes.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${graphRes.status}`);
      }
      const servicesBody = await servicesRes.json();
      const graphBody = await graphRes.json();
      setServices(servicesBody.services || []);
      setManifest(graphBody.manifest || null);
      setCounts(graphBody.counts || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="min-h-[calc(100vh-66px)] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{t('title')}</h1>
            <p className="text-[color:var(--text-secondary)] mt-2">{t('subtitle')}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link
              href="/map"
              className="rounded-lg px-3 py-2 border border-[color:var(--border-color)] text-sm hover:border-[color:var(--text-muted)] transition"
            >
              {tCommon('servicesMap')}
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

        {counts && (
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <CountStat label={t('counts.servers')} value={counts.servers} />
            <CountStat label={t('counts.services')} value={counts.services} />
          </div>
        )}

        {error && <p className="text-sm text-red-400">{t('error')}: {error}</p>}

        {!loading && services.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-12 text-center text-[color:var(--text-muted)]">
            {t('empty')}
          </div>
        )}

        {services.length > 0 && (
          <section className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--surface-elevated)]/30 text-xs uppercase text-[color:var(--text-muted)]">
                <tr>
                  <th className="text-left px-3 py-2">{t('table.name')}</th>
                  <th className="text-left px-3 py-2">{t('table.form')}</th>
                  <th className="text-left px-3 py-2">{t('table.calls')}</th>
                  <th className="text-left px-3 py-2">{t('table.updated')}</th>
                </tr>
              </thead>
              <tbody>
                {services.map((svc) => (
                  <tr key={svc.ref} className="border-t border-[color:var(--border-color)]/60">
                    <td className="px-3 py-2">
                      <Link
                        href={`/mcp-skills/${encodeURIComponent(svc.ref)}`}
                        className="font-medium hover:underline"
                      >
                        {svc.name}
                      </Link>
                      <div className="text-xs text-[color:var(--text-muted)] font-mono mt-0.5">
                        {svc.ref}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[color:var(--text-muted)]">
                      {svc.kind === 'skill' ? t(`forms.${svc.form}`) : t('forms.orbit')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {(svc.calls || []).length === 0 ? (
                          <span className="text-xs text-[color:var(--text-muted)]">-</span>
                        ) : (
                          svc.calls.map((call, i) => <CallPill key={`${call.server}-${i}`} call={call} />)
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-[color:var(--text-muted)] font-mono">
                      {formatTimestamp(svc.mirroredAt || svc.materializedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  );
}
