import { pipelineMeta, screeningStocks } from './data';
import type { FreshnessTag } from './types';

// runDate からの経過日数を計算（ブラウザの実日付基準）
function daysSince(isoDate: string): number {
  const d = new Date(isoDate + 'T00:00:00');
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

type Level = 'fresh' | 'warn' | 'alert';

function levelOf(days: number): Level {
  if (days <= pipelineMeta.staleWarnDays) return 'fresh';
  if (days <= pipelineMeta.staleAlertDays) return 'warn';
  return 'alert';
}

const styles: Record<Level, { box: string; dot: string; label: string; icon: string }> = {
  fresh: {
    box: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'データ最新',
    icon: '✅',
  },
  warn: {
    box: 'bg-amber-50 border-amber-200 text-amber-700',
    dot: 'bg-amber-500',
    label: 'やや古い',
    icon: '⚠️',
  },
  alert: {
    box: 'bg-red-50 border-red-200 text-red-700',
    dot: 'bg-red-500',
    label: '要更新',
    icon: '🔴',
  },
};

export default function FreshnessBanner() {
  const days = daysSince(pipelineMeta.runDate);
  const level = levelOf(days);
  const s = styles[level];

  // 銘柄ごとの鮮度タグ集計
  const counts = screeningStocks.reduce(
    (acc, st) => {
      acc[st.freshness] = (acc[st.freshness] ?? 0) + 1;
      return acc;
    },
    {} as Record<FreshnessTag, number>,
  );
  const critical = counts.critical ?? 0;
  const stale = counts.stale ?? 0;
  // 財務未取得（鮮度保証できない）銘柄
  const unavailable = screeningStocks.filter(st => st.dataSource === 'unavailable').length;

  const daysLabel =
    days <= 0 ? '本日更新' : days === 1 ? '昨日更新' : `${days}日前に更新`;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${s.box}`}
      title={`最終更新: ${pipelineMeta.runDate}（${daysLabel}） / 株価: ${pipelineMeta.priceSource} / 財務: ${pipelineMeta.fundamentalSource}`}
    >
      <span className="relative flex h-2 w-2">
        {level !== 'fresh' && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${s.dot} opacity-60`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`} />
      </span>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <span>{s.icon}</span>
          <span>鮮度: {s.label}</span>
          <span className="font-normal opacity-70">／ {daysLabel}</span>
        </div>
        <div className="text-[10px] font-medium opacity-80">
          最終更新 {pipelineMeta.runDate}
          {(critical > 0 || stale > 0 || unavailable > 0) && (
            <span className="ml-1">
              ・
              {unavailable > 0 && <span className="text-red-600 font-semibold"> 財務未取得{unavailable}件</span>}
              {critical > 0 && <span> 古い財務{critical}件</span>}
              {stale > 0 && <span> 鮮度注意{stale}件</span>}
            </span>
          )}
        </div>
      </div>
      {level === 'alert' && (
        <span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          refresh推奨
        </span>
      )}
    </div>
  );
}
