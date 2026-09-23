import type { FreshnessTag } from './types';

/**
 * 鮮度判定を1か所に集約する。
 *
 * 以前は Python が実行時に計算した `freshness` を data.ts に凍結し、
 * 画面の一部（深掘り）だけが描画時に再計算していた。
 * 閾値は同じでも「いつを基準に数えたか」が違うため、日が経つと
 * 同じ銘柄がスクリーニング画面では normal、深掘り画面では stale になった。
 *
 * 判定は常に「今日」を基準に、この関数だけで行う。
 * 凍結した値は持たない（持てば必ずいつか実際とずれる）。
 */

/** 財務データの鮮度しきい値（決算開示日からの経過カレンダー日数） */
export const FRESHNESS_DAYS = {
  fresh: 30,   // これ以内なら fresh
  normal: 60,  // これ以内なら normal
  stale: 90,   // これ以内なら stale、超えたら critical
} as const;

/** 株価の鮮度しきい値（経過営業日数）。目標は2営業日以内。 */
export const PRICE_BIZ_DAYS = { fresh: 2, warn: 4 } as const;

/** マクロ分析の鮮度しきい値（経過カレンダー日数）。週末更新の運用リズムに合わせる。 */
export const MACRO_DAYS = { fresh: 7, warn: 14 } as const;

/** 経過カレンダー日数。基準日が無い・壊れている場合は null。 */
export function calendarDaysSince(isoDate?: string | null): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

/**
 * 経過営業日数（土日を除く）。基準日が無い・壊れている場合は null。
 * 祝日は考慮していないが、祝日を営業日として数えるぶん日数は多めに出る。
 * 「実際より古く見える」方向の誤差なので、鮮度判定としては安全側に倒れる。
 */
export function businessDaysSince(isoDate?: string | null): number | null {
  if (!isoDate) return null;
  const from = new Date(isoDate + 'T00:00:00');
  if (isNaN(from.getTime())) return null;
  const to = new Date();
  to.setHours(0, 0, 0, 0);
  if (to < from) return 0;

  let days = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

/**
 * 決算開示日から財務データの鮮度タグを求める。
 * 基準日が無い銘柄は鮮度を保証できないため critical とする（安全側）。
 */
export function freshnessOf(irbankDate?: string | null): FreshnessTag {
  const days = calendarDaysSince(irbankDate);
  if (days === null) return 'critical';
  if (days <= FRESHNESS_DAYS.fresh) return 'fresh';
  if (days <= FRESHNESS_DAYS.normal) return 'normal';
  if (days <= FRESHNESS_DAYS.stale) return 'stale';
  return 'critical';
}

/** 銘柄リストの鮮度タグ別件数。常に今日を基準に数え直す。 */
export function freshnessCounts(
  stocks: { irbankDate?: string | null }[],
): Record<FreshnessTag, number> {
  const acc: Record<FreshnessTag, number> = { fresh: 0, normal: 0, stale: 0, critical: 0 };
  for (const s of stocks) acc[freshnessOf(s.irbankDate)]++;
  return acc;
}
