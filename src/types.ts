export type TrapFlag = 'normal' | 'suspicious' | 'dangerous';
export type FreshnessTag = 'fresh' | 'normal' | 'stale' | 'critical';
export type VerdictRating = 'strong_buy' | 'buy' | 'watch' | 'avoid';
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
  freshness: FreshnessTag;
  irbankDate: string;
  equityRatio: number;
  high52w: number;
  consecutiveDividendYears: number;
  trapReasons: string[];
  // 'unavailable' = 財務データを取得できなかった銘柄。代替データで埋めず明示する
  dataSource?: 'edinet_db' | 'irbank' | 'unavailable';
  scoreBreakdown?: ScoreBreakdown;
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

export interface DeepStock extends Stock {
  nextEarnings: string;
  revenueYoY: number;
  opIncomeYoY: number;
  netIncomeYoY: number;
  progressRate: number;
  avg5yProgress: number;
  specialPL: string | null;
  revision: string | null;
  scoreBreakdown: ScoreBreakdown;
  positives: string[];
  risks: string[];
  verdict: string;
  verdictRating: VerdictRating;
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

export interface PortfolioPosition {
  code: string;
  name: string;
  allocation: number;
  type: 'core' | 'satellite' | 'cash';
  buyPrice: number;
  currentPrice: number;
  shares: number;
  verdict: string;
  verdictRating: VerdictRating;
}
