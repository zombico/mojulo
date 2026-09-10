'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';

const fetcher = (url) => fetch(url).then((r) => r.json());

const RANGES = [
  { key: 'last7days', days: 7 },
  { key: 'last14days', days: 14 },
  { key: 'last30days', days: 30 },
  { key: 'last90days', days: 90 },
];

function isoNDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().replace(/\.\d{3}Z$/, '').replace('T', ' ');
}

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '').replace('T', ' ');
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4">
      <div className="text-xs text-[color:var(--text-muted)]">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function DailyBars({ daily, label, noDataLabel }) {
  const max = useMemo(
    () => daily.reduce((m, d) => Math.max(m, d.turns), 0),
    [daily],
  );
  return (
    <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4">
      <div className="text-sm font-medium mb-3">{label}</div>
      {daily.length === 0 ? (
        <p className="text-xs text-[color:var(--text-muted)]">{noDataLabel}</p>
      ) : (
        <div className="flex items-end gap-1 h-32">
          {daily.map((d) => {
            const h = max ? Math.max(2, Math.round((d.turns / max) * 100)) : 2;
            return (
              <div
                key={d.date}
                className="flex-1 bg-[color:var(--brand-teal)]/60 hover:bg-[color:var(--brand-teal)] rounded-sm transition"
                style={{ height: `${h}%` }}
                title={`${d.date}: ${d.turns} turns / ${d.conversations} convos`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Heatmap({ cells, label, noDataLabel, dayLabels }) {
  const grid = useMemo(() => {
    const m = new Map();
    let max = 0;
    for (const c of cells) {
      m.set(`${c.dow}-${c.hour}`, c.turns);
      if (c.turns > max) max = c.turns;
    }
    return { m, max };
  }, [cells]);

  if (cells.length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4">
        <div className="text-sm font-medium mb-3">{label}</div>
        <p className="text-xs text-[color:var(--text-muted)]">{noDataLabel}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4">
      <div className="text-sm font-medium mb-3">{label}</div>
      <div className="overflow-x-auto">
        <table className="text-[10px] border-separate border-spacing-[2px]">
          <tbody>
            {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
              <tr key={dow}>
                <td className="pr-2 text-[color:var(--text-muted)] text-right align-middle">
                  {dayLabels[dow]}
                </td>
                {Array.from({ length: 24 }, (_, hour) => {
                  const v = grid.m.get(`${dow}-${hour}`) || 0;
                  const intensity = grid.max ? v / grid.max : 0;
                  const bg = intensity
                    ? `rgba(34, 211, 238, ${0.15 + 0.75 * intensity})`
                    : 'rgba(255,255,255,0.04)';
                  return (
                    <td
                      key={hour}
                      className="w-4 h-4 rounded-sm"
                      style={{ background: bg }}
                      title={`${dayLabels[dow]} ${hour}:00 — ${v} turns`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopBots({ bots, label, noDataLabel, convsLabel }) {
  if (bots.length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4">
        <div className="text-sm font-medium mb-3">{label}</div>
        <p className="text-xs text-[color:var(--text-muted)]">{noDataLabel}</p>
      </div>
    );
  }
  const max = bots[0]?.turns || 1;
  return (
    <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4">
      <div className="text-sm font-medium mb-3">{label}</div>
      <ul className="space-y-1.5">
        {bots.map((b) => (
          <li key={b.id} className="flex items-center gap-3 text-xs">
            <div className="w-32 truncate" title={b.botName}>
              {b.botName}
            </div>
            <div className="flex-1 h-2 rounded-full bg-[color:var(--surface-elevated)]/40 overflow-hidden">
              <div
                className="h-full bg-[color:var(--brand-teal)]/70"
                style={{ width: `${Math.max(2, (b.turns / max) * 100)}%` }}
              />
            </div>
            <div className="w-20 text-right text-[color:var(--text-muted)] font-mono">
              {b.turns} / {b.conversations} {convsLabel}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalyticsView() {
  const t = useTranslations('data.analytics');
  const tFleet = useTranslations('data.fleet');
  const [rangeKey, setRangeKey] = useState('last7days');
  const [params, setParams] = useState({
    startDate: isoNDaysAgo(7),
    endDate: isoNow(),
  });

  useEffect(() => {
    const r = RANGES.find((x) => x.key === rangeKey);
    if (r) setParams({ startDate: isoNDaysAgo(r.days), endDate: isoNow() });
  }, [rangeKey]);

  const qs = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const { data, isLoading, error } = useSWR(
    `/api/data/analytics?${qs.toString()}`,
    fetcher,
    { refreshInterval: 60_000 },
  );

  const dayLabels = [
    t('days.sun'), t('days.mon'), t('days.tue'), t('days.wed'),
    t('days.thu'), t('days.fri'), t('days.sat'),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRangeKey(r.key)}
            className={`px-3 py-1.5 text-xs rounded-md border transition ${
              rangeKey === r.key
                ? 'border-[color:var(--brand-teal)] text-[color:var(--text-primary)] bg-[color:var(--brand-teal)]/10'
                : 'border-[color:var(--border-color)] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
            }`}
          >
            {t(`dateRange.${r.key}`)}
          </button>
        ))}
      </div>

      {data?.fleet?.unreachableCount > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {tFleet('unreachableBanner', {
            unreachable: data.fleet.unreachableCount,
            total: data.fleet.totalCount,
          })}
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-[color:var(--text-muted)]">{t('loading')}</p>
      )}
      {error && (
        <p className="text-sm text-red-400">{String(error.message || error)}</p>
      )}

      {data && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryTile
              label={t('summary.totalConversations')}
              value={data.totals.conversations}
            />
            <SummaryTile
              label={t('summary.totalTurns')}
              value={data.totals.turns}
            />
            <SummaryTile
              label={t('summary.avgTurnsPerConversation')}
              value={data.totals.avgTurnsPerConversation}
            />
            <SummaryTile
              label={t('summary.activeBots')}
              value={`${data.totals.activeBots} / ${data.totals.totalBots}`}
            />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DailyBars
              daily={data.daily}
              label={t('charts.dailyConversations')}
              noDataLabel={t('noData')}
            />
            <TopBots
              bots={data.topBots}
              label={t('charts.topBotsByActivity')}
              noDataLabel={t('noData')}
              convsLabel={t('convs')}
            />
          </section>

          <section>
            <Heatmap
              cells={data.heatmap}
              label={t('charts.activityHeatmap')}
              noDataLabel={t('noActivityData')}
              dayLabels={dayLabels}
            />
          </section>
        </>
      )}
    </div>
  );
}
