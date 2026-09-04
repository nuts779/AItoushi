import { pipelineMeta, screeningStocks } from './data';
import type { FreshnessTag } from './types';
import { isUnavailable } from './dataSource';

/**
 * 鮮度バナー（株価 / 財務の2系統）
 *
 * 株価は毎営業日動き、財務は四半期に一度しか変わらない。
 * 1つの日付で両方を代表させると、閾値をどちらに合わせても
 * もう一方の鮮度が必ず嘘になるため、別々に判定する。
 */

// 土日を除いた経過営業日数。
// 祝日は考慮していないが、祝日を営業日として数えるぶん経過日数は多めに出る。
// 「実際より古く見える」方向の誤差なので、鮮度判定としては安全側に倒れる。
function businessDaysSince(isoDate: string): number {
  const from = new Date(isoDate + 'T00:00:00');
  const to = new Date();
  to.setHours(0, 0, 0, 0);
  if (isNaN(from.getTime()) || to < from) return 0;

  let days = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

function calendarDaysSince(isoDate: string): number {
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return 9999;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

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
  const priceBizDays = businessDaysSince(priceDate);
  const priceLevel: Level = priceBizDays <= 2 ? 'fresh' : priceBizDays <= 4 ? 'warn' : 'alert';
  const priceHeadline =
    priceBizDays <= 0 ? '本日' : `${priceBizDays}営業日前`;
  const priceFailed = pipelineMeta.priceFailedCount ?? 0;

  // ── 財務：カレンダー日数で判定する（決算サイクルに合わせる） ──
  const fundDays = calendarDaysSince(pipelineMeta.runDate);
  const fundLevel: Level =
    fundDays <= pipelineMeta.staleWarnDays ? 'fresh'
    : fundDays <= pipelineMeta.staleAlertDays ? 'warn'
    : 'alert';

  const counts = screeningStocks.reduce((acc, st) => {
    acc[st.freshness] = (acc[st.freshness] ?? 0) + 1;
    return acc;
  }, {} as Record<FreshnessTag, number>);
  const critical = counts.critical ?? 0;
  const stale = counts.stale ?? 0;
  const unavailable = screeningStocks.filter(st => isUnavailable(st.dataSource)).length;

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
        title={`株価取得日: ${priceDate}（${priceBizDays}営業日前） / ${pipelineMeta.priceSource}\n目標は2営業日以内`}
      />
      <Pill
        label="財務"
        level={fundLevel}
        headline={fundDays <= 0 ? '本日' : `${fundDays}日前`}
        detail={fundIssues.length > 0 ? fundIssues.join('・') : pipelineMeta.runDate}
        title={`スクリーニング実行日: ${pipelineMeta.runDate}（${fundDays}日前） / ${pipelineMeta.fundamentalSource}`}
      />
    </div>
  );
}
