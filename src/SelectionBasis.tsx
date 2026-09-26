import { pipelineMeta, targetSectors } from './data';
import { calendarDaysSince } from './freshness';
import { usePythonEnv, buildCommand, PythonBinNote } from './pythonCommand';

/**
 * この15社が「いつ・どの前提で選ばれたか」を示す。
 *
 * スクリーニングは実行時の業種（＝その時点のマクロ分析が推した業種）で母集団を決めるが、
 * マクロ分析はあとから単独で更新できる。すると画面上は
 *   「マクロが推す業種」と「実際に選定に使われた業種」が食い違ったまま
 * になり、いま推していない業種の銘柄が並んでいることに気づけない。
 * 銘柄の入れ替えにはフルスクリーニングの再実行が必要なので、その事実を明示する。
 */

/** 33業種コード → 名称。data.ts の targetSectors に無いコードを表示するために持つ */
const SECTOR_NAMES: Record<string, string> = {
  '0050': '水産・農林業', '1050': '鉱業', '2050': '建設業', '3050': '食料品',
  '3100': '繊維製品', '3150': 'パルプ・紙', '3200': '化学', '3250': '医薬品',
  '3300': '石油・石炭製品', '3350': 'ゴム製品', '3400': 'ガラス・土石製品',
  '3450': '鉄鋼', '3500': '非鉄金属', '3550': '金属製品', '3600': '機械',
  '3650': '電気機器', '3700': '輸送用機器', '3750': '精密機器', '3800': 'その他製品',
  '4050': '電気・ガス業', '5050': '陸運業', '5100': '海運業', '5150': '空運業',
  '5200': '倉庫・運輸関連業', '5250': '情報・通信業', '6050': '卸売業', '6100': '小売業',
  '7050': '銀行業', '7100': '証券、商品先物取引業', '7150': '保険業', '7200': 'その他金融業',
  '8050': '不動産業', '9050': 'サービス業',
};

function sectorName(code: string): string {
  const fromMacro = targetSectors.find(s => s.code === code)?.name;
  return fromMacro ?? SECTOR_NAMES[code] ?? `業種${code}`;
}

function Chip({ code, tone }: { code: string; tone: 'same' | 'onlyMacro' | 'onlyScreen' }) {
  const cls = {
    same:       'bg-emerald-50 text-emerald-700 border-emerald-200',
    onlyMacro:  'bg-blue-50    text-blue-700    border-blue-200',
    onlyScreen: 'bg-amber-50   text-amber-700   border-amber-200',
  }[tone];
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium whitespace-nowrap ${cls}`}>
      {sectorName(code)}
    </span>
  );
}

export default function SelectionBasis() {
  // 再実行コマンドの Python 名は OS で違う。早期 return より前で呼ぶ（フックの規則）。
  const pyEnv = usePythonEnv();
  const screened = (pipelineMeta.screenedIndustries ?? []).map(String);
  const macro = targetSectors.map(s => s.code);
  const runDays = calendarDaysSince(pipelineMeta.runDate);

  // 実行時の業種が記録されていない古い data.ts では比較できない。
  // 「一致している」とは言えないので、その旨だけ出す。
  if (screened.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-xs text-gray-500">
        この銘柄リストがどの業種を対象に選ばれたかは記録されていません。
        フルスクリーニングを実行すると記録されます。
      </div>
    );
  }

  const same       = macro.filter(c => screened.includes(c));
  const onlyMacro  = macro.filter(c => !screened.includes(c));
  const onlyScreen = screened.filter(c => !macro.includes(c));
  const drifted = onlyMacro.length > 0 || onlyScreen.length > 0;

  return (
    <div className={`rounded-xl p-4 shadow-sm border ${drifted ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'}`}>
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
        <h3 className={`font-bold text-sm ${drifted ? 'text-amber-800' : 'text-gray-900'}`}>
          {drifted ? '⚠ 選定の前提が現在のマクロ分析とずれています' : '✓ 選定の前提は現在のマクロ分析と一致しています'}
        </h3>
        <span className="text-xs text-gray-500 font-mono">
          選定日 {pipelineMeta.runDate}
          {runDays !== null && `（${runDays <= 0 ? '本日' : `${runDays}日前`}）`}
        </span>
      </div>

      <div className="space-y-1.5">
        {same.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 w-44 shrink-0">両方に入っている業種</span>
            {same.map(c => <Chip key={c} code={c} tone="same" />)}
          </div>
        )}
        {onlyMacro.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 w-44 shrink-0">マクロは推すが<strong className="text-blue-700">未選定</strong></span>
            {onlyMacro.map(c => <Chip key={c} code={c} tone="onlyMacro" />)}
          </div>
        )}
        {onlyScreen.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 w-44 shrink-0">選定済みだが<strong className="text-amber-700">現在は非推奨</strong></span>
            {onlyScreen.map(c => <Chip key={c} code={c} tone="onlyScreen" />)}
          </div>
        )}
      </div>

      {drifted && (
        <p className="text-xs text-amber-800 mt-3 pt-2 border-t border-amber-200 leading-relaxed">
          この一覧は <strong>{pipelineMeta.runDate}</strong> 時点の業種で選ばれています。
          その後マクロ分析が更新され、推す業種が変わりました。
          {onlyMacro.length > 0 && <>「未選定」の業種は<strong>一度も候補に入っていません</strong>。</>}
          <br />
          銘柄を選び直すにはフルスクリーニングの再実行が必要です（株価更新では入れ替わりません）。
          <code className="bg-white/70 border border-amber-200 rounded px-1 py-0.5 font-mono ml-1">
            {buildCommand(
              pyEnv.bin,
              `scripts/fetch_stocks.py --industries ${macro.join(',')} --preset ${pipelineMeta.preset} --top 15`,
            )}
          </code>
        </p>
      )}

      {drifted && <PythonBinNote env={pyEnv} />}
    </div>
  );
}
