export type TrapFlag = 'normal' | 'suspicious' | 'dangerous';
export type FreshnessTag = 'fresh' | 'normal' | 'stale' | 'critical';
export type WeatherType = '晴れ' | '曇り' | '嵐';
export type Tab = 'macro' | 'screening' | 'deepdive' | 'portfolio';

export interface Stock {
  rank: number;
  code: string;
  name: string;
  industryCode: string;
  industry: string;
  price: number;
  per: number | null;
  pbr: number;
  roe: number;
  dividendYield: number;
  marketCap: number; // 億円
  score: number;
  deepScore: number;
  trapFlag: TrapFlag;
  // 鮮度タグは持たない。実行時に計算した値を持つと日が経つほど実際とずれるため、
  // 画面側が irbankDate から毎回 freshness.ts で計算する。
  irbankDate: string;
  equityRatio: number;
  high52w: number;
  consecutiveDividendYears: number;
  trapReasons: string[];
  // 'unavailable' = 財務データを取得できなかった銘柄。代替データで埋めず明示する
  dataSource?: 'edinet_db' | 'irbank' | 'unavailable';
  scoreBreakdown?: ScoreBreakdown;
  // 判定できなかった罠ルール（「ルール名: 測れない理由」形式）。
  // trapReasons が空でも、ここが埋まっていれば「罠なしを確認できた」わけではない。
  trapUndetermined?: string[];
}

// null = 算出に必要なデータを取得していない項目（画面には「未算出」と表示する）
export interface ScoreBreakdown {
  catalyst: number | null;   // max 20 … 決算発表予定日が未取得
  momentum: number | null;   // max 20
  supply: number | null;     // max 15 … 信用倍率・出来高が未取得
  valuation: number | null;  // max 15
  downside: number | null;   // max 15
  dividend: number | null;   // max 15
}

export interface EdinetDetail {
  code: string;
  name: string;
  dataSource: 'edinet_db' | 'irbank' | 'unavailable';
  fetchDate: string;
  fiscalYear?: number;
  annualEquityRatio?: number;
  annualROE?: number;
  annualNetIncome?: number;
  annualOrdinaryIncome?: number;
  annualRevenue?: number;
  latestQuarter?: number | null;
  latestDisclosureDate?: string | null;
  latestEquityRatio?: number | null;
  latestNetIncome?: number | null;
  latestNetIncomeChange?: number | null;
  forecastNetIncome?: number | null;
  forecastNetIncomeChange?: number | null;
  // 一次資料へのリンク。数値の出所を確認できない状態を作らないために持つ
  edinetUrl?: string | null;
  earningsPdfUrl?: string | null;
  earningsTitle?: string | null;
}

export interface EconomistReport {
  name: string;
  org: string;
  role: string;
  topics: string[];
  date: string;
  url?: string;
}

export interface TargetSector {
  code: string;
  name: string;
  reason: string;
}

export interface AvoidSector {
  name: string;
  reason: string;
}

// 保有ポジション。売買判断は人間が下すため、推奨・評価の類は持たない。
// note は自分で書いた保有メモ（システムが生成した判断ではない）。
export interface PortfolioPosition {
  code: string;
  name: string;
  allocation: number;
  type: 'core' | 'satellite' | 'cash';
  buyPrice: number;
  currentPrice: number;
  shares: number;
  note?: string;
}
