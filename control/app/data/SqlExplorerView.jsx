'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import SchemaReference from './SchemaReference';

const STARTER_QUERIES = [
  {
    labelKey: 'dailyStats',
    sql: `SELECT date, SUM(conversations) AS conversations, SUM(turns) AS turns
FROM daily_bot_stats
GROUP BY date
ORDER BY date DESC
LIMIT 30`,
  },
  {
    labelKey: 'botHealth',
    sql: `SELECT bot_name, conversations_7d, turns_7d, avg_turns_7d, last_activity_at
FROM bot_health
ORDER BY conversations_7d DESC`,
  },
  {
    labelKey: 'protocolDistribution',
    sql: `SELECT protocol, SUM(turns) AS turns, SUM(conversations_touched) AS conversations
FROM protocol_stats
GROUP BY protocol
ORDER BY turns DESC`,
  },
  {
    labelKey: 'mostActiveBots',
    sql: `SELECT bot_name, conversations_7d, turns_7d
FROM bot_health
ORDER BY conversations_7d DESC
LIMIT 10`,
  },
  {
    labelKey: 'staleBots',
    sql: `SELECT bot_name, last_seen_at, cloud_status
FROM bots
WHERE last_seen_at IS NULL
   OR last_seen_at < datetime('now', '-1 day')
ORDER BY last_seen_at ASC NULLS FIRST`,
  },
  {
    labelKey: 'dailyByBot',
    sql: `SELECT b.bot_name, d.date, d.conversations, d.turns
FROM daily_bot_stats d
JOIN bots b ON b.id = d.bot_id
ORDER BY d.date DESC, d.turns DESC
LIMIT 50`,
  },
];

function ResultsTable({ rows, columns }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="text-xs text-[color:var(--text-muted)] p-3">No rows</p>
    );
  }
  return (
    <div className="overflow-auto max-h-[60vh]">
      <table className="w-full text-sm">
        <thead className="bg-[color:var(--surface-elevated)]/30 text-xs uppercase text-[color:var(--text-muted)] sticky top-0">
          <tr>
            {columns.map((c) => (
              <th key={c} className="text-left px-3 py-2 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-[color:var(--border-color)]/60">
              {columns.map((c) => {
                const v = row[c];
                const display =
                  v === null || v === undefined
                    ? ''
                    : typeof v === 'object'
                      ? JSON.stringify(v)
                      : String(v);
                return (
                  <td
                    key={c}
                    className="px-3 py-1.5 font-mono text-xs text-[color:var(--text-secondary)] whitespace-nowrap max-w-md truncate"
                    title={display}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SqlExplorerView() {
  const t = useTranslations('data.sql');
  const tQueries = useTranslations('data.sql.starterQueries');
  const tFleet = useTranslations('data.fleet');
  const [sql, setSql] = useState(
    'SELECT bot_name, conversations_7d, turns_7d FROM bot_health ORDER BY conversations_7d DESC',
  );
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const runQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/data/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResults(data);
    } catch (e) {
      setError(e.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const exportResults = async (format) => {
    try {
      const res = await fetch('/api/data/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, format }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleet-query.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden border-[color:var(--border-color)]">
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-48 p-4 font-mono text-sm bg-black/40 text-[color:var(--text-primary)] focus:outline-none resize-y"
          spellCheck={false}
          placeholder={t('placeholder')}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={runQuery}
          disabled={loading || !sql.trim()}
          className="rounded-lg px-4 py-2 bg-[color:var(--brand-teal)] text-[color:var(--brand-navy)] font-semibold hover:bg-[color:var(--brand-teal-hover)] transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('running') : t('runQuery')}
        </button>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className={`px-3 py-2 rounded-lg text-sm border transition ${
            showHelp
              ? 'border-[color:var(--brand-teal)] text-[color:var(--text-primary)] bg-[color:var(--brand-teal)]/10'
              : 'border-[color:var(--border-color)] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
          }`}
        >
          {t('help')}
        </button>
        <button
          type="button"
          onClick={() => exportResults('csv')}
          disabled={!results || results.rows?.length === 0}
          className="px-3 py-2 rounded-lg text-sm border border-[color:var(--border-color)] hover:border-[color:var(--text-muted)] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('exportCsv')}
        </button>
        <button
          type="button"
          onClick={() => exportResults('json')}
          disabled={!results || results.rows?.length === 0}
          className="px-3 py-2 rounded-lg text-sm border border-[color:var(--border-color)] hover:border-[color:var(--text-muted)] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('exportJson')}
        </button>
        <span className="text-xs text-[color:var(--text-muted)] self-center ml-2">
          {t('keyboardHint')}
        </span>
      </div>

      {showHelp && (
        <div className="p-4 bg-[color:var(--surface-primary)] border border-[color:var(--border-color)] rounded-lg">
          <h3 className="text-sm font-medium mb-3">{tQueries('title')}</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {STARTER_QUERIES.map((q) => (
              <button
                type="button"
                key={q.labelKey}
                onClick={() => {
                  setSql(q.sql);
                  setShowHelp(false);
                }}
                className="text-left p-3 rounded-md border border-[color:var(--border-color)] hover:border-[color:var(--text-muted)] transition"
              >
                <span className="text-sm font-medium">{tQueries(q.labelKey)}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-[color:var(--text-muted)]">
            {tQueries('hint')}
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md border border-red-500/40 bg-red-500/10 text-red-300 font-mono text-xs">
          {error}
        </div>
      )}

      {results?.fleet?.unreachableCount > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {tFleet('unreachableBanner', {
            unreachable: results.fleet.unreachableCount,
            total: results.fleet.totalCount,
          })}
        </div>
      )}

      {results && (
        <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--surface-primary)]">
          <div className="text-xs text-[color:var(--text-muted)] px-3 py-2 border-b border-[color:var(--border-color)]/60">
            {t('rowCount', { count: results.rowCount })}
            {results.truncated && ` ${t('truncated')}`}
          </div>
          <ResultsTable rows={results.rows} columns={results.columns} />
        </div>
      )}

      <SchemaReference />
    </div>
  );
}
