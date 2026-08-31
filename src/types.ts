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
  dataSource?: 'edinet_db' | 'irbank';
}

export interface ScoreBreakdown {
  catalyst: number;   // max 20
  momentum: number;   // max 20
  supply: number;     // max 15
  valuation: number;  // max 15
  downside: number;   // max 15
  dividend: number;   // max 15
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
  dataSource: 'edinet_db' | 'irbank';
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
