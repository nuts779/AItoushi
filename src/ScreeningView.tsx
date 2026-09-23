import { useState } from 'react';
import { screeningStocks, pipelineMeta } from './data';
import { latestEarnings } from './earnings';
import type { TrapFlag, FreshnessTag } from './types';
import { freshnessOf, freshnessCounts, calendarDaysSince, FRESHNESS_DAYS } from './freshness';
import SelectionBasis from './SelectionBasis';
import ScreeningRunButton from './ScreeningRunButton';   // 不要になったらこの行と下の1行を消す

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
// 鮮度は開示日から毎回計算する。モジュールのトップレベルで1回だけ評価されるため、
// 日付をまたいでタブを開いたままにしていると古いままになる点だけ注意
//（リロードで解消する。凍結値と違い data.ts には残らない）。
const fCounts    = freshnessCounts(screeningStocks);
// 罠検出10ルールのうち、データが無くて評価できなかった件数。
// trapFlag='normal' の中身が「確認して問題なし」なのか「測っていない」のかを
// 区別できるようにするために集計する。
const TRAP_RULE_COUNT = 10;
const undeterminedTotal = screeningStocks.reduce((a, s) => a + (s.trapUndetermined?.length ?? 0), 0);
const fullyCheckedN = screeningStocks.filter(s => (s.trapUndetermined?.length ?? 0) === 0).length;

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
      {/* この15社がいつ・どの業種を前提に選ばれたか */}
      <div className="space-y-2">
        <SelectionBasis />
        <div className="flex justify-end">
          <ScreeningRunButton />
        </div>
      </div>

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
            sub: `全${TRAP_RULE_COUNT}ルール評価済み ${fullyCheckedN}/${screeningStocks.length}社・判定不能 計${undeterminedTotal}件`,
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
          { label: `fresh ${fCounts.fresh}`,       cls: freshBadge['fresh'] },
          { label: `normal ${fCounts.normal}`,     cls: freshBadge['normal'] },
          { label: `stale ${fCounts.stale}`,       cls: freshBadge['stale'] },
          { label: `critical ${fCounts.critical}`, cls: freshBadge['critical'] },
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
                {/* 「深掘り対象」バッジは廃止。この表の15社は全社がEDINET深掘り済みで、
                    バッジの閾値(70点)と深掘りタブの表示条件(90点)が食い違っていた。 */}
                <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">{s.name}</td>
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
                    {(() => {
                      const tag = freshnessOf(s.irbankDate);
                      return (
                        <span className={`text-xs px-2 py-0.5 rounded font-mono ${freshBadge[tag]}`}>
                          {tag}
                        </span>
                      );
                    })()}
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

      {/* 判定不能の一覧。該当ゼロを「問題なし」と読ませないための表示 */}
      {undeterminedTotal > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-gray-700 font-bold mb-1 text-sm">? 判定不能だったルール</h3>
          <p className="text-gray-400 text-xs mb-3">
            データが取得できず評価していない項目です。「問題なし」ではありません。
            罠フラグが normal でも、ここに項目がある銘柄は一次資料での確認が必要です。
          </p>
          <div className="space-y-2.5">
            {screeningStocks
              .filter(s => (s.trapUndetermined?.length ?? 0) > 0)
              .map(s => (
                <div key={s.code} className="flex gap-3 items-start text-sm">
                  <span className="text-xs px-2 py-0.5 rounded font-mono shrink-0 bg-gray-100 text-gray-500 border border-gray-200">
                    {s.trapUndetermined?.length}件
                  </span>
                  <div>
                    <span className="text-gray-800 font-medium">{s.name}（{s.code}）</span>
                    <ul className="mt-1 space-y-0.5">
                      {s.trapUndetermined?.map((u, i) => (
                        <li key={i} className="text-gray-500 text-xs">• {u}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Trap details */}
      {screeningStocks.filter(s => s.trapReasons.length > 0).length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-amber-700 font-bold mb-1 text-sm">⚠ 罠検出に該当した銘柄</h3>
          <p className="text-gray-400 text-xs mb-3">
            {TRAP_RULE_COUNT}ルールのうち該当したものとその根拠。該当1件で suspicious（−15点）、2件以上で dangerous（−30点）。
          </p>
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
