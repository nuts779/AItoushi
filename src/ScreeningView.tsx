import { useState } from 'react';
import { screeningStocks, pipelineMeta } from './data';
import { latestEarnings } from './earnings';
import type { TrapFlag, FreshnessTag } from './types';

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 999;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

const trapBadge: Record<TrapFlag, string> = {
  normal:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  suspicious:'bg-amber-50  text-amber-700  border border-amber-200',
  dangerous: 'bg-red-50    text-red-700    border border-red-200',
};
const trapLabel: Record<TrapFlag, string> = {
  normal: 'normal', suspicious: 'suspicious', dangerous: 'DANGEROUS',
};

const freshBadge: Record<FreshnessTag, string> = {
  fresh:    'bg-emerald-50 text-emerald-700',
  normal:   'bg-blue-50    text-blue-700',
  stale:    'bg-amber-50   text-amber-700',
  critical: 'bg-red-50     text-red-700',
};

const dangerous  = screeningStocks.filter(s => s.trapFlag === 'dangerous').length;
const suspicious = screeningStocks.filter(s => s.trapFlag === 'suspicious').length;
const normalN    = screeningStocks.filter(s => s.trapFlag === 'normal').length;
const freshN     = screeningStocks.filter(s => s.freshness === 'fresh').length;
const normalFN   = screeningStocks.filter(s => s.freshness === 'normal').length;
const staleN     = screeningStocks.filter(s => s.freshness === 'stale').length;
const criticalN  = screeningStocks.filter(s => s.freshness === 'critical').length;

// pipelineMeta に件数が無い（古い data.ts）場合でも壊れないようにする
function count(n: number | undefined): string {
  return typeof n === 'number' ? `${n.toLocaleString()}社` : '—';
}

type SortKey = 'rank' | 'price' | 'per' | 'roe' | 'deepScore' | 'dividendYield';

export default function ScreeningView() {
  const [sortKey, setSortKey]     = useState<SortKey>('rank');
  const [sortAsc, setSortAsc]     = useState(true);
  const [filterTrap, setFilterTrap] = useState<TrapFlag | 'all'>('all');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = [...screeningStocks]
    .filter(s => filterTrap === 'all' || s.trapFlag === filterTrap)
    .sort((a, b) => {
      const aVal = sortKey === 'per' ? (a.per ?? 999) : a[sortKey];
      const bVal = sortKey === 'per' ? (b.per ?? 999) : b[sortKey];
      return sortAsc ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(k)}
      className={`flex items-center gap-1 ${sortKey === k ? 'text-emerald-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
    >
      {label}
      {sortKey === k && <span className="text-xs">{sortAsc ? '▲' : '▼'}</span>}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: '母集団',
            value: count(pipelineMeta.universeCount),
            sub: '対象業種・プライム/スタンダード',
            color: 'text-gray-700',
          },
          {
            label: '1段階目',
            value: count(pipelineMeta.stage1Count),
            sub: 'プリセット通過（ROE/PER/PBR/配当）',
            color: 'text-blue-600',
          },
          {
            label: '2段階目（EDINET DB）',
            value: count(pipelineMeta.deepCount),
            sub: 'スコア60以上・罠検出済',
            color: 'text-emerald-600',
          },
          {
            label: '罠検出',
            value: `D:${dangerous} S:${suspicious} N:${normalN}`,
            sub: `最終出力${screeningStocks.length}社の内訳`,
            color: 'text-amber-600',
          },
        ].map((item, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-gray-400 text-xs mb-1">{item.label}</div>
            <div className={`text-xl font-bold font-mono ${item.color}`}>{item.value}</div>
            <div className="text-gray-400 text-xs mt-1">{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Freshness bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-center text-sm">
        <span className="text-gray-500 text-xs font-semibold" title="決算開示日からの経過による分類">
          財務鮮度サマリー：
        </span>
        {[
          { label: `fresh ${freshN}`,    cls: freshBadge['fresh'] },
          { label: `normal ${normalFN}`, cls: freshBadge['normal'] },
          { label: `stale ${staleN}`,    cls: freshBadge['stale'] },
          { label: `critical ${criticalN}`, cls: freshBadge['critical'] },
        ].map((b, i) => (
          <span key={i} className={`text-xs px-2 py-0.5 rounded font-mono ${b.cls}`}>{b.label}</span>
        ))}
        <span className="text-gray-300 text-xs ml-auto">
          実行日: {pipelineMeta.runDate} | プリセット: {pipelineMeta.preset ?? '—'}
        </span>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap items-center">
        {(['all', 'normal', 'suspicious', 'dangerous'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterTrap(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              filterTrap === f
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? '全件' : f}
          </button>
        ))}
        <span className="text-gray-400 text-xs ml-2">{sorted.length}件表示</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs">
              <th className="px-4 py-3 text-left"><SortBtn k="rank" label="順位" /></th>
              <th className="px-4 py-3 text-left text-gray-500">コード</th>
              <th className="px-4 py-3 text-left text-gray-500">銘柄名</th>
              <th className="px-4 py-3 text-left text-gray-500">業種</th>
              <th className="px-4 py-3 text-right"><SortBtn k="price" label="株価" /></th>
              <th className="px-4 py-3 text-right"><SortBtn k="per" label="PER" /></th>
              <th className="px-4 py-3 text-right text-gray-500">PBR</th>
              <th className="px-4 py-3 text-right"><SortBtn k="roe" label="ROE%" /></th>
              <th className="px-4 py-3 text-right"><SortBtn k="dividendYield" label="配当%" /></th>
              <th className="px-4 py-3 text-right"><SortBtn k="deepScore" label="スコア" /></th>
              <th className="px-4 py-3 text-center text-gray-500">罠</th>
              <th
                className="px-4 py-3 text-center text-gray-500 whitespace-nowrap"
                title="決算短信が開示されてからの経過。株価の古さではありません（株価はヘッダーの「株価」表示を参照）"
              >
                財務鮮度
                <div className="text-[10px] font-normal text-gray-400">決算開示からの経過</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr
                key={s.code}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  s.trapFlag === 'dangerous'
                    ? 'bg-red-50/40'
                    : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                }`}
              >
                <td className="px-4 py-3 font-mono text-gray-400 text-xs">{s.rank}</td>
                <td className="px-4 py-3 font-mono text-emerald-600 font-bold">{s.code}</td>
                <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">
                  {s.name}
                  {s.deepScore >= 70 && (
                    <span className="ml-2 text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded">
                      深掘り対象
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{s.industry}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800 font-semibold">{s.price.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">
                  {s.per !== null ? s.per.toFixed(1) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">{s.pbr.toFixed(1)}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-600 font-semibold">{s.roe.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right font-mono text-blue-600">{s.dividendYield.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-bold font-mono text-lg ${
                    s.deepScore >= 70 ? 'text-emerald-600' : s.deepScore >= 60 ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {s.deepScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${trapBadge[s.trapFlag]}`}>
                    {trapLabel[s.trapFlag]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded font-mono ${freshBadge[s.freshness]}`}>
                      {s.freshness}
                    </span>
                    {s.dataSource === 'edinet_db' ? (
                      <>
                        {(() => {
                          const e = latestEarnings(s.code);
                          return e ? (
                            <span className="text-gray-500 text-xs font-medium whitespace-nowrap">
                              {e.label} {e.date}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs font-mono">{s.irbankDate || '—'}</span>
                          );
                        })()}
                        <span className="text-gray-300 text-[10px] font-mono">
                          {s.irbankDate && daysSince(s.irbankDate) < 999 ? `${daysSince(s.irbankDate)}日前` : '—'}
                        </span>
                      </>
                    ) : s.dataSource === 'irbank' ? (
                      <span className="text-gray-300 text-xs">—</span>
                    ) : (
                      <span className="text-red-600 text-xs font-semibold">財務未取得</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trap details */}
      {screeningStocks.filter(s => s.trapReasons.length > 0).length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-amber-700 font-bold mb-3 text-sm">⚠ 罠検出銘柄の詳細</h3>
          <div className="space-y-3">
            {screeningStocks.filter(s => s.trapReasons.length > 0).map(s => (
              <div key={s.code} className="flex gap-3 items-start text-sm">
                <span className={`text-xs px-2 py-0.5 rounded font-mono shrink-0 ${trapBadge[s.trapFlag]}`}>
                  {trapLabel[s.trapFlag]}
                </span>
                <div>
                  <span className="text-gray-800 font-medium">{s.name}（{s.code}）</span>
                  <span className="text-gray-400 text-xs ml-2">
                    スコア {s.score}→{s.deepScore}（{s.deepScore - s.score > 0 ? '+' : ''}{s.deepScore - s.score}）
                  </span>
                  <ul className="mt-1 space-y-0.5">
                    {s.trapReasons.map((r, i) => (
                      <li key={i} className="text-gray-500 text-xs">• {r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
