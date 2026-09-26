import { pipelineMeta, screeningStocks, macroMeta } from './data';
import { isUnavailable } from './dataSource';
import {
  businessDaysSince, calendarDaysSince, freshnessCounts, priceFreshnessLabel,
  PRICE_BIZ_DAYS, MACRO_DAYS,
} from './freshness';

/**
 * 鮮度バナー（株価 / 財務 / マクロの3系統）
 *
 * 株価は毎営業日動き、財務は四半期に一度、マクロは週単位で変わる。
 * 1つの日付でまとめて代表させると、閾値をどれに合わせても
 * 他の鮮度が必ず嘘になるため、別々に判定する。
 *
 * 判定に使う日数計算としきい値は freshness.ts に集約している。
 */

type Level = 'fresh' | 'warn' | 'alert';

const levelStyle: Record<Level, { box: string; dot: string; icon: string }> = {
  fresh: { box: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500', icon: '✅' },
  warn:  { box: 'bg-amber-50 border-amber-200 text-amber-700',       dot: 'bg-amber-500',   icon: '⚠️' },
  alert: { box: 'bg-red-50 border-red-200 text-red-700',             dot: 'bg-red-500',     icon: '🔴' },
};

function Pill({
  label, level, headline, detail, title,
}: { label: string; level: Level; headline: string; detail?: string; title: string }) {
  const s = levelStyle[level];
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${s.box}`} title={title}>
      <span className="relative flex h-2 w-2 shrink-0">
        {level !== 'fresh' && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${s.dot} opacity-60`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`} />
      </span>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
          <span>{s.icon}</span>
          <span>{label}</span>
          <span className="font-normal opacity-80">{headline}</span>
        </div>
        {detail && <div className="text-[10px] font-medium opacity-80 whitespace-nowrap">{detail}</div>}
      </div>
    </div>
  );
}

export default function FreshnessBanner() {
  // ── 株価：営業日ベースで判定する ──
  // 金曜終値は月曜時点でカレンダー3日前だが、営業日では1日前。
  // カレンダー日数で判定すると毎週月曜に必ず警告が出てしまう。
  const priceDate = pipelineMeta.priceDate ?? pipelineMeta.runDate;
  const priceBizDays = businessDaysSince(priceDate) ?? 9999;
  const priceLevel: Level =
    priceBizDays <= PRICE_BIZ_DAYS.fresh ? 'fresh'
    : priceBizDays <= PRICE_BIZ_DAYS.warn ? 'warn'
    : 'alert';
  // 「0営業日 = 本日」ではない。週末は金曜終値のまま0営業日になるため、
  // 文言の組み立ては freshness.ts に任せる（BUG-022）。
  const priceHeadline = priceFreshnessLabel(priceDate);
  const priceFailed = pipelineMeta.priceFailedCount ?? 0;

  // ── 財務：カレンダー日数で判定する（決算サイクルに合わせる） ──
  const fundDays = calendarDaysSince(pipelineMeta.runDate) ?? 9999;
  const fundLevel: Level =
    fundDays <= pipelineMeta.staleWarnDays ? 'fresh'
    : fundDays <= pipelineMeta.staleAlertDays ? 'warn'
    : 'alert';

  // 銘柄ごとの鮮度は開示日から今日を基準に計算する（data.ts の凍結値は使わない）
  const counts = freshnessCounts(screeningStocks);
  const critical = counts.critical;
  const stale = counts.stale;
  const unavailable = screeningStocks.filter(st => isUnavailable(st.dataSource)).length;

  // ── マクロ：カレンダー日数で判定する（週末更新の運用リズムに合わせる） ──
  // 分析の実行日を持たない古い data.ts では判定できないため「不明」と出す。
  // 記事日付で代用すると、1か月前の分析でも記事が新しければ緑になってしまう。
  const macroDate = macroMeta.generatedDate ?? null;
  const macroDays = calendarDaysSince(macroDate);
  const macroLevel: Level =
    macroDays === null ? 'alert'
    : macroDays <= MACRO_DAYS.fresh ? 'fresh'
    : macroDays <= MACRO_DAYS.warn ? 'warn'
    : 'alert';

  const fundIssues: string[] = [];
  if (unavailable > 0) fundIssues.push(`未取得${unavailable}件`);
  if (critical > 0) fundIssues.push(`古い財務${critical}件`);
  if (stale > 0) fundIssues.push(`注意${stale}件`);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Pill
        label="株価"
        level={priceLevel}
        headline={priceHeadline}
        detail={
          priceFailed > 0
            ? `${priceDate}・取得失敗${priceFailed}件`
            : priceDate
        }
        title={`株価取得日: ${priceDate}（${priceHeadline}） / ${pipelineMeta.priceSource}\n`
          + `経過営業日数: ${priceBizDays}（目標は${PRICE_BIZ_DAYS.fresh}営業日以内）\n`
          + '土日は前営業日の終値のままになる。これ以上新しい株価は存在しない'}
      />
      <Pill
        label="財務"
        level={fundLevel}
        headline={fundDays <= 0 ? '本日' : `${fundDays}日前`}
        detail={fundIssues.length > 0 ? fundIssues.join('・') : pipelineMeta.runDate}
        title={`スクリーニング実行日: ${pipelineMeta.runDate}（${fundDays}日前） / ${pipelineMeta.fundamentalSource}`}
      />
      <Pill
        label="マクロ"
        level={macroLevel}
        headline={
          macroDays === null ? '実行日不明'
          : macroDays <= 0 ? '本日'
          : `${macroDays}日前`
        }
        detail={macroDate ?? '再実行してください'}
        title={
          macroDate
            ? `マクロ分析の実行日: ${macroDate}（${macroDays}日前）\n`
              + `参考記事の最新日: ${macroMeta.latestArticleDate}\n`
              + `目標は${MACRO_DAYS.fresh}日以内（週末更新）。絞り込み業種はこの分析に連動します`
            : 'この data.ts には分析の実行日が記録されていません。マクロ分析を再実行すると記録されます'
        }
      />
    </div>
  );
}
