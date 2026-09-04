import { edinetDetails } from './data';

// 決算の鮮度表示まわり。
// 「38日前」だけを出すと株価の古さと誤読されるため、
// 「どの決算か」を添えて、これが決算開示日基準であることを明示する。

/** EDINET の quarter（1〜4）を表示用ラベルにする。4 は通期（本決算）。 */
export function quarterLabel(q?: number | null): string | null {
  if (q == null) return null;
  return q === 4 ? '通期決算' : `Q${q}決算`;
}

/** 月/日 形式（決算開示日を短く見せる用） */
export function shortDate(iso?: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${Number(m[1])}/${Number(m[2])}` : null;
}

/** 銘柄コードから直近決算の情報を引く（見つからなければ null） */
export function latestEarnings(code: string): { label: string; date: string } | null {
  const d = edinetDetails.find(e => e.code === code);
  if (!d) return null;
  const label = quarterLabel(d.latestQuarter);
  const date = shortDate(d.latestDisclosureDate);
  if (!label || !date) return null;
  return { label, date };
}
