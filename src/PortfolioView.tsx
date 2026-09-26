import { useState } from 'react';
import { portfolioPositions, edinetDetails, screeningStocks, pipelineMeta } from './data';
import type { EdinetDetail, PortfolioPosition } from './types';
import { sourceStyle, isUnavailable } from './dataSource';
import { SourceLinks } from './SourceLinks';

function chg(v: number | null | undefined) {
  if (v == null) return null;
  return { val: v, cls: v >= 0 ? 'text-emerald-600' : 'text-red-500', str: `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` };
}

function EdinetRow({ d, rank }: { d: EdinetDetail; rank: number }) {
  const hasAnnual = d.dataSource === 'edinet_db' && d.fiscalYear != null;
  const hasLatest = d.latestDisclosureDate != null;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2.5 font-mono text-gray-400 text-xs">{rank}</td>
      <td className="px-3 py-2.5">
        <div className="font-mono text-emerald-600 font-bold text-xs">{d.code}</div>
        <div className="text-gray-700 text-xs whitespace-nowrap">{d.name}</div>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${sourceStyle(d.dataSource).badge}`}>
          {sourceStyle(d.dataSource).short}
        </span>
      </td>
      {/* Annual */}
      <td className="px-3 py-2.5 text-center font-mono text-xs text-gray-500">{hasAnnual ? `FY${d.fiscalYear}` : '—'}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">
        {hasAnnual ? <span className={`font-semibold ${(d.annualEquityRatio ?? 0) >= 60 ? 'text-emerald-600' : (d.annualEquityRatio ?? 0) >= 40 ? 'text-blue-600' : 'text-red-500'}`}>{d.annualEquityRatio}%</span> : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">
        {hasAnnual ? <span className={`font-semibold ${(d.annualROE ?? 0) >= 20 ? 'text-emerald-600' : 'text-blue-600'}`}>{d.annualROE}%</span> : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-700">{hasAnnual ? `${d.annualNetIncome}億` : '—'}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-600">{hasAnnual ? `${d.annualRevenue}億` : '—'}</td>
      {/* Latest disclosure */}
      <td className="px-3 py-2.5 text-center font-mono text-xs text-gray-500">
        {hasLatest ? `Q${d.latestQuarter} ${d.latestDisclosureDate}` : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">
        {hasLatest && d.latestNetIncomeChange != null
          ? <span className={chg(d.latestNetIncomeChange)?.cls}>{chg(d.latestNetIncomeChange)?.str}</span>
          : <span className="text-gray-300">—</span>
        }
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">
        {hasLatest && d.forecastNetIncome != null
          ? <span className="text-gray-700">{(d.forecastNetIncome / 100).toFixed(1)}億</span>
          : <span className="text-gray-300">—</span>
        }
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">
        {hasLatest && d.forecastNetIncomeChange != null
          ? <span className={chg(d.forecastNetIncomeChange)?.cls}>{chg(d.forecastNetIncomeChange)?.str}</span>
          : <span className="text-gray-300">—</span>
        }
      </td>
      <td className="px-3 py-2.5 text-center"><SourceLinks d={d} compact /></td>
      <td className="px-3 py-2.5 text-center font-mono text-xs text-gray-400">{d.fetchDate}</td>
    </tr>
  );
}

const typeConfig = {
  core:      { label: 'コア',      cls: 'text-emerald-700', barCls: 'bg-emerald-500', bgCls: 'bg-emerald-50 border-emerald-200' },
  satellite: { label: 'サテライト', cls: 'text-blue-700',    barCls: 'bg-blue-500',    bgCls: 'bg-blue-50   border-blue-200' },
  cash:      { label: '現金',      cls: 'text-gray-500',    barCls: 'bg-gray-300',    bgCls: 'bg-gray-50   border-gray-200' },
};

// 保有1件ぶんの表示。損益は買値と現在値から計算した事実のみで、評価や推奨は出さない。
function PositionCard({ p, accent }: { p: PortfolioPosition; accent: 'emerald' | 'blue' }) {
  const pnl = (p.currentPrice - p.buyPrice) * p.shares;
  const pct = p.buyPrice > 0 ? ((p.currentPrice - p.buyPrice) / p.buyPrice) * 100 : 0;
  const codeCls = accent === 'emerald' ? 'text-emerald-600' : 'text-blue-600';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-3 min-w-56">
          <span className={`${codeCls} font-mono font-bold`}>{p.code}</span>
          <div>
            <div className="text-gray-900 font-semibold">{p.name}</div>
            <div className="text-gray-400 text-xs">{p.shares}株 × ¥{p.buyPrice.toLocaleString()}</div>
          </div>
        </div>
        <div className="flex gap-6 flex-wrap">
          <div>
            <div className="text-gray-400 text-xs">現在値</div>
            <div className="text-gray-800 font-mono font-semibold">¥{p.currentPrice.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">含み損益</div>
            <div className={`font-mono font-semibold ${pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {pnl >= 0 ? '+' : ''}¥{pnl.toLocaleString()}
              <span className="text-xs ml-1">({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">配分</div>
            <div className="text-gray-700 font-mono font-semibold">{p.allocation}%</div>
          </div>
        </div>
      </div>
      {p.note && (
        <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
          <span className="text-gray-400">メモ:</span> {p.note}
        </div>
      )}
    </div>
  );
}

function EmptyPortfolio() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-gray-900 font-bold mb-2">保有ポジションは登録されていません</h3>
      <p className="text-gray-500 text-sm leading-relaxed">
        以前ここには、買値と現在値が同じ（＝一度も保有していない）サンプル銘柄が
        「◎ 強推奨」バッジつきで表示されていました。<br />
        推奨は計算されたものではなく手書きの固定文で、しかも現在のスクリーニング結果とは
        1社も一致していなかったため撤去しました。
      </p>
      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="text-gray-600 text-xs font-semibold mb-1.5">登録するには</div>
        <p className="text-gray-500 text-xs mb-2">
          <code className="bg-white border border-gray-200 rounded px-1 py-0.5 font-mono">src/data.ts</code> の
          <code className="bg-white border border-gray-200 rounded px-1 py-0.5 font-mono ml-1">portfolioPositions</code> に、実際に保有している銘柄を書きます。
        </p>
        <pre className="text-[11px] font-mono text-gray-600 bg-white border border-gray-200 rounded p-2 overflow-x-auto">
{`{ code: '6331', name: '三菱化工機', allocation: 25, type: 'core',
  buyPrice: 3245, currentPrice: 3245, shares: 100, note: '自分用のメモ' }`}
        </pre>
      </div>
      <p className="text-gray-400 text-xs mt-3">
        下の「取得財務データ一覧」は保有の有無に関係なく、直近のスクリーニング結果15社を表示しています。
      </p>
    </div>
  );
}

export default function PortfolioView() {
  const [showData, setShowData] = useState(false);
  const stocks = portfolioPositions.filter(p => p.type !== 'cash');
  const cash = portfolioPositions.find(p => p.type === 'cash');
  const corePositions      = portfolioPositions.filter(p => p.type === 'core');
  const satellitePositions = portfolioPositions.filter(p => p.type === 'satellite');
  const hasPositions = portfolioPositions.length > 0;

  const totalCost = stocks.reduce((acc, p) => acc + p.buyPrice * p.shares, 0);
  const totalValue = stocks.reduce((acc, p) => acc + p.currentPrice * p.shares, 0);
  const totalPnL = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const unavailableCount = edinetDetails.filter(d => isUnavailable(d.dataSource)).length;
  const irbankCount = edinetDetails.filter(d => d.dataSource === 'irbank').length;
  const linkedCount = edinetDetails.filter(d => d.edinetUrl || d.earningsPdfUrl).length;

  return (
    <div className="space-y-6">
      {!hasPositions ? (
        <EmptyPortfolio />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-gray-400 text-xs mb-1">評価額（株式）</div>
              <div className="text-gray-900 text-xl font-bold font-mono">¥{totalValue.toLocaleString()}</div>
              <div className="text-gray-400 text-xs mt-1">現金除く</div>
            </div>
            <div className={`bg-white border rounded-xl p-4 shadow-sm ${totalPnL >= 0 ? 'border-emerald-200' : 'border-red-200'}`}>
              <div className="text-gray-400 text-xs mb-1">損益（含み）</div>
              <div className={`text-xl font-bold font-mono ${totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalPnL >= 0 ? '+' : ''}¥{totalPnL.toLocaleString()}
              </div>
              <div className={`text-xs mt-1 font-semibold ${totalPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-gray-400 text-xs mb-1">ポジション数</div>
              <div className="text-gray-900 text-xl font-bold font-mono">{stocks.length}銘柄</div>
              <div className="text-gray-400 text-xs mt-1">コア{corePositions.length} + サテライト{satellitePositions.length}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="text-gray-400 text-xs mb-1">現金比率</div>
              <div className="text-gray-700 text-xl font-bold font-mono">{cash?.allocation ?? 0}%</div>
              <div className="text-gray-400 text-xs mt-1">リバランス・追加買い用</div>
            </div>
          </div>

          {/* Allocation Bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-gray-900 font-bold mb-4">ポートフォリオ配分</h3>
            <div className="flex h-9 rounded-lg overflow-hidden border border-gray-200 mb-4">
              {portfolioPositions.map((p, i) => (
                <div
                  key={i}
                  style={{ width: `${p.allocation}%` }}
                  className={`${typeConfig[p.type].barCls} flex items-center justify-center text-white text-xs font-bold transition-all`}
                  title={`${p.name} ${p.allocation}%`}
                >
                  {p.allocation >= 10 && `${p.allocation}%`}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              {portfolioPositions.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm ${typeConfig[p.type].barCls}`} />
                  <span className={`font-medium ${typeConfig[p.type].cls}`}>[{typeConfig[p.type].label}]</span>
                  <span>{p.name} {p.allocation}%</span>
                </div>
              ))}
            </div>
          </div>

          {corePositions.length > 0 && (
            <div>
              <h3 className="text-gray-900 font-bold mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> コア枠
              </h3>
              <div className="space-y-3">
                {corePositions.map(p => <PositionCard key={p.code} p={p} accent="emerald" />)}
              </div>
            </div>
          )}

          {satellitePositions.length > 0 && (
            <div>
              <h3 className="text-gray-900 font-bold mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> サテライト枠
              </h3>
              <div className="space-y-3">
                {satellitePositions.map(p => <PositionCard key={p.code} p={p} accent="blue" />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Financial Data Panel */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          onClick={() => setShowData(v => !v)}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-gray-900 font-bold">取得財務データ一覧（上位15社）</span>
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-mono">
              取得日: {pipelineMeta.runDate}
            </span>
            <span className="text-xs text-gray-400">
              EDINET DB {edinetDetails.filter(d => d.dataSource === 'edinet_db').length}社
              {irbankCount > 0 && ` / IRBANK ${irbankCount}社`}
            </span>
            <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded">
              一次資料リンクあり {linkedCount}社
            </span>
            {unavailableCount > 0 && (
              <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded font-semibold">
                財務未取得 {unavailableCount}社
              </span>
            )}
          </div>
          <span className="text-gray-400 text-sm">{showData ? '▲ 閉じる' : '▼ 開く'}</span>
        </button>

        {showData && (
          <div className="border-t border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th colSpan={4} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">銘柄</th>
                  <th colSpan={4} className="px-3 py-2 text-center text-xs font-semibold text-blue-600 border-l border-gray-200">
                    年次（有報ベース）
                  </th>
                  <th colSpan={4} className="px-3 py-2 text-center text-xs font-semibold text-emerald-600 border-l border-gray-200">
                    直近決算短信
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-400 border-l border-gray-200">出所</th>
                </tr>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-400">
                  <th className="px-3 py-2 text-left">順位</th>
                  <th className="px-3 py-2 text-left">銘柄</th>
                  <th className="px-3 py-2 text-center">ソース</th>
                  <th className="px-3 py-2 text-center border-l border-gray-200">年度</th>
                  <th className="px-3 py-2 text-right">自己資本比率</th>
                  <th className="px-3 py-2 text-right">ROE</th>
                  <th className="px-3 py-2 text-right">純利益</th>
                  <th className="px-3 py-2 text-right">売上高</th>
                  <th className="px-3 py-2 text-center border-l border-gray-200">開示日</th>
                  <th className="px-3 py-2 text-right">純利益増減</th>
                  <th className="px-3 py-2 text-right">通期予想純利益</th>
                  <th className="px-3 py-2 text-right">予想増減</th>
                  <th className="px-3 py-2 text-center border-l border-gray-200">一次資料</th>
                  <th className="px-3 py-2 text-center">取得日</th>
                </tr>
              </thead>
              <tbody>
                {screeningStocks.map(s => {
                  const d = edinetDetails.find(d => d.code === s.code);
                  if (!d) return null;
                  return <EdinetRow key={s.code} d={d} rank={s.rank} />;
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 space-y-1">
              <div>• 年次データ: 最新有価証券報告書（EDINET DB）/ IRBANKフォールバック銘柄は詳細なし</div>
              <div>• 直近決算短信: TDNet開示（Q=四半期、Q4=通期）/ API直近30日ウィンドウ外の場合は取得不可</div>
              <div>• 純利益・売上高はEDINET DB取得値（百万→億円換算）</div>
              <div>• 「一次資料」の <span className="font-semibold text-blue-600">有報</span> はEDINET提出書類、
                <span className="font-semibold text-blue-600"> 短信</span> は発行体サイトの決算短信PDFを開きます。数値はここで原本と突き合わせられます</div>
              <div>• 「取得日」はスクリーニングを実行した日。画面を開いた日ではありません</div>
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
        <p className="text-gray-400 text-xs">
          ⚠ 本ダッシュボードは公開情報の整理を目的としており、金融アドバイスではありません。<br />
          売買の判断はご自身の責任において行ってください。
        </p>
      </div>
    </div>
  );
}
