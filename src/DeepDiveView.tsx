import { useState } from 'react';
import { screeningStocks, pipelineMeta } from './data';
import type { Stock, TrapFlag, ScoreBreakdown } from './types';
import { sourceStyle, isUnavailable } from './dataSource';
import { latestEarnings } from './earnings';
import { SourceLinksByCode } from './SourceLinks';
import { freshnessOf, calendarDaysSince, FRESHNESS_DAYS } from './freshness';

const trapBadge: Record<TrapFlag, { cls: string; label: string }> = {
  normal:    { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: '✓ normal' },
  suspicious:{ cls: 'bg-amber-50  text-amber-700  border border-amber-200',   label: '⚠ suspicious' },
  dangerous: { cls: 'bg-red-50    text-red-700    border border-red-200',     label: '✕ dangerous' },
};

// 鮮度の閾値・計算は freshness.ts に集約している（画面ごとに持つとずれる）
const tagColor = {
  fresh:    'text-emerald-600',
  normal:   'text-blue-600',
  stale:    'text-amber-600',
  critical: 'text-red-500',
} as const;

function FreshnessLabel({ code, irbankDate, dataSource }: { code: string; irbankDate: string; dataSource?: string }) {
  const days = calendarDaysSince(irbankDate);
  const style = sourceStyle(dataSource);
  const earnings = latestEarnings(code);
  const tag = freshnessOf(irbankDate);
  const color = tagColor[tag];

  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold ${style.badge}`}>{style.short}</span>
      {earnings && (
        <span className="text-xs text-gray-500 font-medium">{earnings.label} {earnings.date}</span>
      )}
      <span className={`text-xs font-mono font-semibold ${color}`}>
        {days === null ? '基準日なし' : days > 0 ? `${days}日前` : '本日取得'}
      </span>
      <span className={`text-xs ${color}`}>[{tag}]</span>
    </span>
  );
}

function ScoreGauge({ score, deepScore }: { score: number; deepScore: number }) {
  const delta = deepScore - score;
  const pct = deepScore;
  const bar = deepScore >= 90 ? 'bg-emerald-500' : deepScore >= 75 ? 'bg-blue-500' : 'bg-amber-400';
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-gray-500 text-xs">deepScore</span>
        <span className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold font-mono ${deepScore >= 90 ? 'text-emerald-600' : 'text-blue-600'}`}>{deepScore}</span>
          <span className="text-gray-400 text-xs">/100</span>
          {delta !== 0 && (
            <span className={`text-xs font-mono font-semibold ml-1 ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              ({delta > 0 ? '+' : ''}{delta})
            </span>
          )}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${bar} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-gray-400 text-xs">yfinance score: {score} → EDINET深掘り後: {deepScore}</div>
    </div>
  );
}

// 6項目評価の定義。max は仕様書（ui/deepdive.md）の配点。
// note は「なぜ算出できないか」。データが無いことを黙って隠さず理由まで出す。
const SCORE_ITEMS: {
  key: keyof ScoreBreakdown; label: string; max: number; note?: string;
}[] = [
  { key: 'catalyst',  label: '① カタリスト',     max: 20, note: '決算発表予定日を未取得' },
  { key: 'momentum',  label: '② モメンタム',     max: 20 },
  { key: 'supply',    label: '③ 需給・テクニカル', max: 15, note: '信用倍率・出来高を未取得' },
  { key: 'valuation', label: '④ バリュエーション', max: 15 },
  { key: 'downside',  label: '⑤ 下値リスク',     max: 15 },
  { key: 'dividend',  label: '⑥ 配当',           max: 15, note: '連続増配ぶん3点は未取得' },
];

function ScoreBar({ label, value, max, note }: {
  label: string; value: number | null | undefined; max: number; note?: string;
}) {
  const scored = typeof value === 'number';
  const ratio = scored ? value / max : 0;
  const bar = ratio >= 0.75 ? 'bg-emerald-500' : ratio >= 0.5 ? 'bg-blue-500' : 'bg-amber-400';

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        {scored ? (
          <span className="font-mono text-gray-700">
            <span className="font-semibold">{value}</span>
            <span className="text-gray-400"> / {max}</span>
          </span>
        ) : (
          <span className="font-mono text-gray-400">未算出</span>
        )}
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        {scored ? (
          <div className={`${bar} h-1.5 rounded-full`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        ) : (
          <div className="h-1.5 rounded-full bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_4px,transparent_4px,transparent_8px)] w-full" />
        )}
      </div>
      {!scored && note && <div className="text-[10px] text-gray-400">{note}</div>}
    </div>
  );
}

function ScorePanel({ breakdown }: { breakdown?: ScoreBreakdown }) {
  if (!breakdown) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500">
        6項目評価は未取得です。スクリーニングを再実行すると算出されます。
      </div>
    );
  }

  // 算出できた項目だけを合計する。未算出を0点として混ぜると
  // 「評価が低い」のか「測っていない」のか区別できなくなる。
  const scoredItems = SCORE_ITEMS.filter(i => typeof breakdown[i.key] === 'number');
  const earned = scoredItems.reduce((a, i) => a + (breakdown[i.key] as number), 0);
  const scoredMax = scoredItems.reduce((a, i) => a + i.max, 0);
  const missing = 100 - scoredMax;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h4 className="text-gray-700 font-semibold text-sm">6項目評価</h4>
        <span className="text-xs font-mono text-gray-500">
          <span className="font-bold text-gray-700">{earned}</span> / {scoredMax}点
          {missing > 0 && <span className="text-gray-400">（未算出 {missing}点ぶん）</span>}
        </span>
      </div>
      <div className="space-y-2.5 bg-gray-50 rounded-lg p-3">
        {SCORE_ITEMS.map(i => (
          <ScoreBar key={i.key} label={i.label} value={breakdown[i.key]} max={i.max} note={i.note} />
        ))}
      </div>
    </div>
  );
}

// 罠検出10ルールの結果。3つの状態を必ず描き分ける。
//   ・該当     … 減点された理由
//   ・判定不能 … データが無くて測れなかったルールと、その理由
//   ・確認済み … 実際に評価して問題が無かった件数
// 判定不能を黙って隠すと「罠なしを確認できた」ように見えてしまうため、
// 件数と理由を必ず画面に出す（本プロジェクトの原則③）。
const TRAP_RULE_COUNT = 10;

function TrapPanel({ s }: { s: Stock }) {
  const reasons = s.trapReasons ?? [];
  const undetermined = s.trapUndetermined ?? [];
  const checked = Math.max(0, TRAP_RULE_COUNT - reasons.length - undetermined.length);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h4 className="text-gray-700 font-semibold text-sm">罠検出（{TRAP_RULE_COUNT}ルール）</h4>
        <span className="text-xs font-mono text-gray-500">
          該当 {reasons.length} · 判定不能 {undetermined.length} · 確認済み {checked}
        </span>
      </div>

      {reasons.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-amber-700 font-semibold text-xs mb-1.5">⚠ 該当した項目</div>
          {reasons.map((r, i) => (
            <p key={i} className="text-amber-700 text-xs">• {r}</p>
          ))}
        </div>
      )}

      {undetermined.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-gray-600 font-semibold text-xs mb-1.5">
            ? 判定不能（データが無く評価していない項目）
          </div>
          {undetermined.map((u, i) => (
            <p key={i} className="text-gray-500 text-xs">• {u}</p>
          ))}
          <p className="text-gray-400 text-[10px] mt-1.5">
            これらは「問題なし」ではなく「測っていない」項目です。一次資料での確認が必要です。
          </p>
        </div>
      )}

      {reasons.length === 0 && undetermined.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
          ✓ {TRAP_RULE_COUNT}ルールすべてを評価し、該当はありませんでした。
        </div>
      )}
    </div>
  );
}

function StockCard({ s, expanded, onToggle }: { s: Stock; expanded: boolean; onToggle: () => void }) {
  const downPct   = (((s.price - s.high52w) / s.high52w) * 100).toFixed(1);
  const posFromLow = s.high52w > 0
    ? Math.round(((s.price - s.high52w * 0.7) / (s.high52w - s.high52w * 0.7)) * 100)
    : 0;
  const trap      = trapBadge[s.trapFlag];

  return (
    <div className={`bg-white border rounded-xl overflow-hidden shadow-sm ${expanded ? 'border-emerald-300' : 'border-gray-200'}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className="text-gray-300 font-mono text-2xl font-bold w-8">#{s.rank}</div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-900 font-bold text-lg">{s.name}</span>
              <span className="text-emerald-600 font-mono text-sm font-semibold">({s.code})</span>
              <span className={`text-xs px-2 py-0.5 rounded font-mono ${trap.cls}`}>{trap.label}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-gray-400 text-xs">{s.industry}</span>
              <FreshnessLabel code={s.code} irbankDate={s.irbankDate} dataSource={s.dataSource} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold font-mono text-gray-900">
              {s.price.toLocaleString()}<span className="text-sm text-gray-400 font-normal">円</span>
            </div>
            <div className="text-xs text-gray-400">52週高値比 {downPct}%</div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-center min-w-[52px] ${s.deepScore >= 90 ? 'bg-emerald-600' : 'bg-blue-600'} text-white`}>
            <div className="text-xs font-semibold opacity-80">score</div>
            <div className="text-lg font-bold font-mono leading-tight">{s.deepScore}</div>
          </div>
          <span className="text-gray-300 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Quick metrics */}
      <div className="grid grid-cols-3 md:grid-cols-6 border-t border-gray-100 divide-x divide-gray-100 bg-gray-50">
        {[
          { label: 'PER',          val: s.per !== null ? `${s.per}x` : '—' },
          { label: 'PBR',          val: `${s.pbr}x` },
          { label: 'ROE',          val: `${s.roe}%` },
          { label: '配当利回',     val: s.dividendYield > 0 ? `${s.dividendYield}%` : '—' },
          { label: '自己資本比率', val: `${s.equityRatio}%` },
          { label: '時価総額',     val: `${s.marketCap}億` },
        ].map((m, i) => (
          <div key={i} className="px-3 py-2.5 text-center">
            <div className="text-gray-400 text-xs">{m.label}</div>
            <div className="text-gray-700 font-mono text-sm font-semibold mt-0.5">{m.val}</div>
          </div>
        ))}
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 p-5 grid md:grid-cols-2 gap-6">
          {/* Left: スコア詳細 */}
          <div className="space-y-5">
            <ScoreGauge score={s.score} deepScore={s.deepScore} />

            {/* 6項目評価（算出できた項目のみ点数を出す） */}
            <ScorePanel breakdown={s.scoreBreakdown} />

            {/* 財務健全性（EDINET/IRBANK値） */}
            <div>
              <h4 className="text-gray-700 font-semibold text-sm mb-3">財務健全性</h4>
              <div className="space-y-2 bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">自己資本比率</span>
                  <span className={`font-mono font-semibold ${s.equityRatio >= 60 ? 'text-emerald-600' : s.equityRatio >= 40 ? 'text-blue-600' : 'text-red-500'}`}>
                    {s.equityRatio}%
                    {s.equityRatio >= 60 && <span className="text-xs ml-1 text-emerald-500">高水準</span>}
                    {s.equityRatio < 40  && <span className="text-xs ml-1 text-red-400">⚠ 低水準</span>}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">ROE</span>
                  <span className={`font-mono font-semibold ${s.roe >= 20 ? 'text-emerald-600' : s.roe >= 10 ? 'text-blue-600' : 'text-gray-600'}`}>
                    {s.roe}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">PBR</span>
                  <span className={`font-mono font-semibold ${s.pbr < 1 ? 'text-emerald-600' : s.pbr < 2 ? 'text-blue-600' : 'text-gray-600'}`}>
                    {s.pbr}x
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">PER</span>
                  <span className="font-mono font-semibold text-gray-700">{s.per !== null ? `${s.per}x` : '—'}</span>
                </div>
              </div>
            </div>

            {/* 罠検出結果。該当・判定不能・確認済みを必ず区別して出す */}
            <TrapPanel s={s} />
          </div>

          {/* Right: 株価ポジションとデータ情報 */}
          <div className="space-y-4">
            {/* 52週レンジポジション */}
            <div>
              <h4 className="text-gray-700 font-semibold text-sm mb-3">52週レンジ内ポジション</h4>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>安値（推定）</span>
                  <span>高値 ¥{s.high52w.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 relative">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.max(5, Math.min(100, posFromLow))}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">現在値 ¥{s.price.toLocaleString()}</span>
                  <span className={`font-mono font-semibold ${parseFloat(downPct) > -15 ? 'text-amber-600' : 'text-blue-600'}`}>
                    高値比 {downPct}%
                  </span>
                </div>
              </div>
            </div>

            {/* データソース情報 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 text-xs">
              <h4 className="text-gray-600 font-semibold text-sm mb-1">データ取得情報</h4>
              <div className="flex justify-between">
                <span className="text-gray-500">株価・指標（yfinance）</span>
                <span className="font-mono text-gray-700">{pipelineMeta.priceDate ?? pipelineMeta.runDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">財務データソース</span>
                <span className={`font-mono font-semibold ${sourceStyle(s.dataSource).text}`}>
                  {sourceStyle(s.dataSource).label}
                </span>
              </div>
              {(() => {
                const d = calendarDaysSince(s.irbankDate);
                const tooOld = d === null || d > FRESHNESS_DAYS.stale;
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">財務データ基準日</span>
                      <span className={`font-mono ${tooOld ? 'text-red-500 font-semibold' : 'text-gray-700'}`}>
                        {d === null ? '取得できていません' : `${s.irbankDate}（${d}日前）`}
                      </span>
                    </div>
                    {d !== null && d > FRESHNESS_DAYS.stale && (
                      <div className="text-amber-600 bg-amber-50 rounded p-2 mt-1">
                        ⚠ 財務データが{FRESHNESS_DAYS.stale}日超経過。最新決算との乖離の可能性あり。
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="pt-2 border-t border-gray-200">
                <div className="text-gray-500 mb-1.5">一次資料で確認する</div>
                <SourceLinksByCode code={s.code} size="md" showTitle />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeepDiveView() {
  // スクリーニングの最終出力はすべてEDINETで深掘り済みなので、点数で絞らない。
  // 以前は deepScore >= 90 で絞っていたが、罠検出で減点された銘柄
  //（＝いちばん詳しく見たい銘柄）がここから消えてしまっていた。
  const targets = screeningStocks;
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const toggle = (i: number) => setExpandedIdx(prev => prev === i ? null : i);

  const edinetCount      = targets.filter(s => s.dataSource === 'edinet_db').length;
  const irbankCount      = targets.filter(s => s.dataSource === 'irbank').length;
  const unavailableCount = targets.filter(s => isUnavailable(s.dataSource)).length;
  const trapHitCount     = targets.filter(s => (s.trapReasons?.length ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <div className="text-gray-900 font-bold">深掘り分析対象</div>
            <div className="text-gray-500 text-xs mt-0.5">
              スクリーニング最終出力 {targets.length}社（全社EDINET深掘り済み） ·
              実行日: {pipelineMeta.runDate}
            </div>
          </div>
          <div className="flex gap-3 text-xs flex-wrap">
            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded font-bold">
              EDINET DB {edinetCount}社
            </span>
            {irbankCount > 0 && (
              <span className="bg-gray-100 text-gray-600 border border-gray-200 px-2 py-1 rounded font-bold">
                IRBANK {irbankCount}社
              </span>
            )}
            {unavailableCount > 0 && (
              <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded font-bold">
                財務未取得 {unavailableCount}社
              </span>
            )}
            {trapHitCount > 0 && (
              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded font-bold">
                罠検出あり {trapHitCount}社
              </span>
            )}
          </div>
        </div>

        {/* データ鮮度の注記 */}
        <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
          <div className="font-semibold">📊 データ構成について</div>
          <div>• <strong>株価・PER・PBR・ROE</strong>: {pipelineMeta.priceDate ?? pipelineMeta.runDate} yfinance取得</div>
          <div>• <strong>自己資本比率・罠検出</strong>: EDINET DB有報ベース（最終決算期の提出日）/ IRBANKスクレイプ</div>
          <div>• 財務データは最新決算期の有価証券報告書に基づく。「X日前」は財務データの基準日を示す</div>
        </div>
      </div>

      <div className="space-y-4">
        {targets.map((s, i) => (
          <StockCard key={s.code} s={s} expanded={expandedIdx === i} onToggle={() => toggle(i)} />
        ))}
      </div>
    </div>
  );
}
