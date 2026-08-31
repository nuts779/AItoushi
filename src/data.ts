import type {
  EconomistReport,
  TargetSector,
  AvoidSector,
  Stock,
  DeepStock,
  PortfolioPosition,
  EdinetDetail,
} from './types';

export const weather = '曇り' as const;
export const weatherDetail = '内外リスク残るも内需・DX系は晴れ間あり';

// マクロ分析のメタ情報
// latestArticleDate: 参考にした記事の中で最新の日付
// Claude Code がマクロ分析を更新する際、economistReports と一緒に更新する
export const macroMeta = {
  latestArticleDate: '2026-04-12',
};

export const economistReports: EconomistReport[] = [
  {
    name: '木内 登英',
    org: 'NRI',
    role: 'エグゼクティブ・エコノミスト',
    url: 'https://www.nri.com/jp/media/column/kiuchi/index.html',
    topics: [
      '米国関税政策の不確実性が依然高く、世界的なリスクオフ圧力が継続中',
      '日銀の追加利上げは7月以降に先送りの可能性が高まりつつある',
      '原油価格は地政学リスクから上振れリスクあり。内需株への注目度が上昇',
      '中国経済の回復鈍化が輸出関連セクターに逆風となる可能性',
    ],
    date: '2026-04-12',
  },
  {
    name: '藤代 宏一',
    org: '第一生命経済研究所',
    role: 'チーフエコノミスト',
    url: 'https://www.dlri.co.jp/members/fujishiro.html',
    topics: [
      'ドル円は148〜152円のレンジを想定。急激な円高リスクは現時点で後退',
      '日本の実質賃金は3ヶ月連続プラス。個人消費回復が内需を下支え',
      '日本株は米国株連動の構造が強く、NYダウの動向が引き続きカギ',
      '情報通信・国内インフラ系は地政学耐性が相対的に高い',
    ],
    date: '2026-04-11',
  },
  {
    name: '武者 陵司',
    org: '武者リサーチ',
    role: '代表',
    url: 'https://www.musha.co.jp/',
    topics: [
      '日本株の大局観は強気継続。PBR改革の第2ステージ入りを確認',
      '内需・DX・インフラ投資は政策的追い風が継続。特に官公庁DX予算拡大',
      'コーポレートガバナンス改革が資本効率改善を加速。ROE向上銘柄に注目',
      '2026年後半にかけて日経平均4万円台回復シナリオを維持',
    ],
    date: '2026-04-10',
  },
];

export const targetSectors: TargetSector[] = [
  { code: '5250', name: '情報・通信業', reason: 'DX需要継続・官公庁IT予算拡大、地政学耐性高い内需型' },
  { code: '2050', name: '建設業', reason: '国土強靭化・インフラ老朽化対策で政策追い風が継続' },
  { code: '3050', name: '食料品', reason: 'ディフェンシブ安定、値上げ効果で利益率改善トレンド継続' },
  { code: '3250', name: '医薬品', reason: '高齢化社会の構造需要、円安でも内需型で為替耐性あり' },
  { code: '9050', name: 'サービス業', reason: 'BPO・省力化投資需要拡大。賃上げ波及で付加価値型サービスが有利' },
];

export const avoidSectors: AvoidSector[] = [
  { name: '海運業', reason: '地政学リスクで運賃変動大、中国景気減速の直撃を受ける' },
  { name: '空運業', reason: '原油高での燃料費増大リスク、インバウンド効果の一巡感' },
  { name: '鉄鋼業', reason: '中国の過剰供給懸念、米国関税の間接影響波及' },
  { name: '輸送用機器', reason: 'EV競争激化・関税影響の不透明感が続く' },
];

// スクリーニング対象業種は targetSectors（最新マクロで絞り込んだ業種）から自動生成する。
// マクロ分析を更新すると targetSectors が変わり、このコマンドの --industries も自動で追従する。
export const targetIndustryCodes = targetSectors.map((s) => s.code).join(',');
export const generatedCommand =
  `python scripts/fetch_stocks.py --industries ${targetIndustryCodes} --preset stable_defensive --top 15`;

export const pipelineMeta = {
  runDate: '2026-04-21',
  priceSource: 'yfinance（当日終値・補助）',
  fundamentalSource: 'EDINET DB（公式XBRL・毎日8時更新）',
  edinetCount: 6,
  unavailableCount: 0,
  // データが古い場合に警告するしきい値（日数）
  staleWarnDays: 7,
  staleAlertDays: 30,
};

// JPX実データ（取得日: 2026-04-21）
// rank は deepScore 降順で付番
export const screeningStocks: Stock[] = [
  {
    rank: 1, code: '3771', name: 'システムリサーチ', industryCode: '5250', industry: '情報・通信業',
    price: 1733.0, per: 11.9, pbr: 2.27, roe: 20.38, dividendYield: 4.06, marketCap: 287,
    score: 93, deepScore: 96, trapFlag: 'normal', freshness: 'critical', irbankDate: '2025-05-15',
    equityRatio: 67.3, high52w: 2280.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
  },
  {
    rank: 2, code: '3925', name: 'ダブルスタンダード', industryCode: '5250', industry: '情報・通信業',
    price: 1395.0, per: 12.74, pbr: 2.96, roe: 21.4, dividendYield: 4.28, marketCap: 189,
    score: 93, deepScore: 96, trapFlag: 'normal', freshness: 'critical', irbankDate: '2026-02-13',
    equityRatio: 84.8, high52w: 1955.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
  },
  {
    rank: 3, code: '4641', name: 'アルプス技研', industryCode: '9050', industry: 'サービス業',
    price: 2574.0, per: 12.7, pbr: 2.48, roe: 20.4, dividendYield: 4.18, marketCap: 505,
    score: 93, deepScore: 96, trapFlag: 'normal', freshness: 'critical', irbankDate: '2026-02-12',
    equityRatio: 69.5, high52w: 3170.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
  },
  {
    rank: 4, code: '9416', name: 'ビジョン', industryCode: '5250', industry: '情報・通信業',
    price: 1142.0, per: 12.4, pbr: 2.64, roe: 23.06, dividendYield: 5.0, marketCap: 562,
    score: 93, deepScore: 96, trapFlag: 'normal', freshness: 'critical', irbankDate: '2026-02-13',
    equityRatio: 69.2, high52w: 1343.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
  },
  {
    rank: 5, code: '211A', name: 'カドス・コーポレーション', industryCode: '2050', industry: '建設業',
    price: 4050.0, per: null, pbr: 0.94, roe: 15.55, dividendYield: 4.42, marketCap: 41,
    score: 94, deepScore: 94, trapFlag: 'normal', freshness: 'critical', irbankDate: '2026-03-13',
    equityRatio: 55.8, high52w: 5350.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
  },
  {
    rank: 6, code: '2410', name: 'キャリアデザインセンター', industryCode: '9050', industry: 'サービス業',
    price: 2459.0, per: 11.73, pbr: 2.96, roe: 27.26, dividendYield: 5.09, marketCap: 129,
    score: 93, deepScore: 93, trapFlag: 'normal', freshness: 'critical', irbankDate: '2025-05-15',
    equityRatio: 59.8, high52w: 2569.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
  },
  {
    rank: 7, code: '1430', name: 'ファーストコーポレーション', industryCode: '2050', industry: '建設業',
    price: 1121.0, per: 10.63, pbr: 1.31, roe: 15.01, dividendYield: 8.19, marketCap: 134,
    score: 91, deepScore: 91, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-04-21',
    equityRatio: 50, high52w: 1151.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'irbank',
  },
  {
    rank: 8, code: '1814', name: '大末建設', industryCode: '2050', industry: '建設業',
    price: 3365.0, per: 11.82, pbr: 1.43, roe: 16.19, dividendYield: 5.12, marketCap: 350,
    score: 91, deepScore: 91, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-04-21',
    equityRatio: 50, high52w: 4505.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'irbank',
  },
  {
    rank: 9, code: '1870', name: '矢作建設工業', industryCode: '2050', industry: '建設業',
    price: 2048.0, per: 8.46, pbr: 1.21, roe: 15.32, dividendYield: 4.38, marketCap: 884,
    score: 91, deepScore: 91, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-04-21',
    equityRatio: 50, high52w: 2534.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'irbank',
  },
  {
    rank: 10, code: '2154', name: 'オープンアップグループ', industryCode: '9050', industry: 'サービス業',
    price: 1757.0, per: 11.53, pbr: 1.92, roe: 17.19, dividendYield: 4.85, marketCap: 1492,
    score: 91, deepScore: 91, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-04-21',
    equityRatio: 50, high52w: 1979.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'irbank',
  },
  {
    rank: 11, code: '3922', name: 'ＰＲ　ＴＩＭＥＳ', industryCode: '5250', industry: '情報・通信業',
    price: 2062.0, per: 11.8, pbr: 3.0, roe: 29.64, dividendYield: 0, marketCap: 279,
    score: 91, deepScore: 91, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-04-21',
    equityRatio: 50, high52w: 3340.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'irbank',
  },
  {
    rank: 12, code: '4595', name: 'ミズホメディー', industryCode: '3250', industry: '医薬品',
    price: 1808.0, per: 10.06, pbr: 1.84, roe: 19.01, dividendYield: 5.5, marketCap: 344,
    score: 91, deepScore: 91, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-04-21',
    equityRatio: 50, high52w: 1930.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'irbank',
  },
  {
    rank: 13, code: '4674', name: 'クレスコ', industryCode: '5250', industry: '情報・通信業',
    price: 1432.0, per: 12.85, pbr: 1.79, roe: 16.22, dividendYield: 4.03, marketCap: 578,
    score: 91, deepScore: 91, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-04-21',
    equityRatio: 50, high52w: 1827.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'irbank',
  },
  {
    rank: 14, code: '6061', name: 'ユニバーサル園芸社', industryCode: '9050', industry: 'サービス業',
    price: 2952.0, per: 13.23, pbr: 1.9, roe: 15.38, dividendYield: 0, marketCap: 272,
    score: 91, deepScore: 91, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-04-21',
    equityRatio: 50, high52w: 3490.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'irbank',
  },
  {
    rank: 15, code: '6070', name: 'キャリアリンク', industryCode: '9050', industry: 'サービス業',
    price: 2396.0, per: 12.18, pbr: 1.82, roe: 18.44, dividendYield: 4.99, marketCap: 285,
    score: 91, deepScore: 91, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-04-21',
    equityRatio: 50, high52w: 2815.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'irbank',
  },
];

// EDINET DB / IRBANK から取得した財務詳細データ（上位15社）
// fetchDate: 取得実行日, annual: 有報ベース年次, latest: 直近決算短信
export const edinetDetails: EdinetDetail[] = [
  {
    code: '3771', name: 'システムリサーチ', dataSource: 'edinet_db', fetchDate: '2026-04-21',
    fiscalYear: 2025, annualEquityRatio: 67.3, annualROE: 19.6, annualNetIncome: 21.9, annualOrdinaryIncome: 30.7, annualRevenue: 259.3,
    latestQuarter: null, latestDisclosureDate: null, latestEquityRatio: null,
    latestNetIncome: null, latestNetIncomeChange: null, forecastNetIncome: null, forecastNetIncomeChange: null,
  },
  {
    code: '3925', name: 'ダブルスタンダード', dataSource: 'edinet_db', fetchDate: '2026-04-21',
    fiscalYear: 2025, annualEquityRatio: 84.8, annualROE: 30.1, annualNetIncome: 17.8, annualOrdinaryIncome: 26.1, annualRevenue: 80.0,
    latestQuarter: 3, latestDisclosureDate: '2026-02-13', latestEquityRatio: 92.3,
    latestNetIncome: 801, latestNetIncomeChange: -37.1, forecastNetIncome: 1456, forecastNetIncomeChange: -18.3,
  },
  {
    code: '4641', name: 'アルプス技研', dataSource: 'edinet_db', fetchDate: '2026-04-21',
    fiscalYear: 2025, annualEquityRatio: 69.5, annualROE: 20.4, annualNetIncome: 39.8, annualOrdinaryIncome: 55.4, annualRevenue: 526.5,
    latestQuarter: 4, latestDisclosureDate: '2026-02-12', latestEquityRatio: 69.5,
    latestNetIncome: 3981, latestNetIncomeChange: 8.3, forecastNetIncome: 3900, forecastNetIncomeChange: -2.0,
  },
  {
    code: '9416', name: 'ビジョン', dataSource: 'edinet_db', fetchDate: '2026-04-21',
    fiscalYear: 2025, annualEquityRatio: 69.2, annualROE: 23.6, annualNetIncome: 45.2, annualOrdinaryIncome: 64.7, annualRevenue: 390.1,
    latestQuarter: 4, latestDisclosureDate: '2026-02-13', latestEquityRatio: 69.2,
    latestNetIncome: 4522, latestNetIncomeChange: 34.0, forecastNetIncome: 5100, forecastNetIncomeChange: 12.8,
  },
  {
    code: '211A', name: 'カドス・コーポレーション', dataSource: 'edinet_db', fetchDate: '2026-04-21',
    fiscalYear: 2025, annualEquityRatio: 55.8, annualROE: 15.6, annualNetIncome: 6.6, annualOrdinaryIncome: 9.4, annualRevenue: 75.9,
    latestQuarter: 2, latestDisclosureDate: '2026-03-13', latestEquityRatio: 56.0,
    latestNetIncome: 95, latestNetIncomeChange: -70.0, forecastNetIncome: 675, forecastNetIncomeChange: 2.6,
  },
  {
    code: '2410', name: 'キャリアデザインセンター', dataSource: 'edinet_db', fetchDate: '2026-04-21',
    fiscalYear: 2025, annualEquityRatio: 59.8, annualROE: 25.7, annualNetIncome: 11.0, annualOrdinaryIncome: 16.0, annualRevenue: 186.5,
    latestQuarter: null, latestDisclosureDate: null, latestEquityRatio: null,
    latestNetIncome: null, latestNetIncomeChange: null, forecastNetIncome: null, forecastNetIncomeChange: null,
  },
  {
    code: '1430', name: 'ファーストコーポレーション', dataSource: 'edinet_db', fetchDate: '2026-04-21',
    fiscalYear: 2025, annualEquityRatio: 39.2, annualROE: 18.3, annualNetIncome: 16.7, annualOrdinaryIncome: 24.8, annualRevenue: 431.9,
    latestQuarter: null, latestDisclosureDate: null, latestEquityRatio: null,
    latestNetIncome: null, latestNetIncomeChange: null, forecastNetIncome: null, forecastNetIncomeChange: null,
  },
  {
    code: '3922', name: 'PR TIMES', dataSource: 'edinet_db', fetchDate: '2026-04-21',
    fiscalYear: 2025, annualEquityRatio: 82.9, annualROE: 17.9, annualNetIncome: 11.2, annualOrdinaryIncome: 18.7, annualRevenue: 80.0,
    latestQuarter: 4, latestDisclosureDate: '2026-04-13', latestEquityRatio: 78.9,
    latestNetIncome: 2397, latestNetIncomeChange: 114.3, forecastNetIncome: 2200, forecastNetIncomeChange: -8.3,
  },
  {
    code: '4674', name: 'クレスコ', dataSource: 'edinet_db', fetchDate: '2026-04-21',
    fiscalYear: 2025, annualEquityRatio: 71.1, annualROE: 15.1, annualNetIncome: 44.1, annualOrdinaryIncome: 62.9, annualRevenue: 587.6,
    latestQuarter: 3, latestDisclosureDate: '2026-02-06', latestEquityRatio: 71.7,
    latestNetIncome: 3583, latestNetIncomeChange: 22.4, forecastNetIncome: 4900, forecastNetIncomeChange: 11.2,
  },
  { code: '1814', name: '大末建設',           dataSource: 'irbank', fetchDate: '2026-04-21' },
  { code: '1870', name: '矢作建設工業',        dataSource: 'irbank', fetchDate: '2026-04-21' },
  { code: '2154', name: 'オープンアップグループ', dataSource: 'irbank', fetchDate: '2026-04-21' },
  { code: '4595', name: 'ミズホメディー',      dataSource: 'irbank', fetchDate: '2026-04-21' },
  { code: '6061', name: 'ユニバーサル園芸社',  dataSource: 'irbank', fetchDate: '2026-04-21' },
  { code: '6070', name: 'キャリアリンク',      dataSource: 'irbank', fetchDate: '2026-04-21' },
];

export const deepStocks: DeepStock[] = [
  {
    rank: 1, code: '3771', name: 'システムリサーチ', industryCode: '5250', industry: '情報・通信業',
    price: 1733, per: 11.9, pbr: 2.27, roe: 20.38, dividendYield: 4.06, marketCap: 287,
    score: 93, deepScore: 96, trapFlag: 'normal', freshness: 'critical', irbankDate: '2025-05-15',
    equityRatio: 67.3, high52w: 2280, consecutiveDividendYears: 0, trapReasons: [],
    nextEarnings: '2026-05-15',
    revenueYoY: 9.8, opIncomeYoY: 18.6, netIncomeYoY: 16.2,
    progressRate: 83.4, avg5yProgress: 77.9,
    specialPL: null, revision: null,
    scoreBreakdown: { catalyst: 16, momentum: 16, supply: 14, valuation: 15, downside: 14, dividend: 13 },
    positives: [
      '製造業・流通向けERPの開発・保守が主力。ストック収益比率が高く景気感応度が低い安定型ビジネス',
      'EDINET確認：自己資本比率67.3%・ROE 20.38%と財務健全性と収益性を両立。罠フラグなし',
      'PER 11.9倍・配当4.1%で情報通信セクターでは割安水準。52週高値(2,280円)から-24%の押し目圏',
    ],
    risks: [
      '大手SIerへの依存度が高く、案件単価交渉力で不利になる場面がある',
      '人材確保コスト上昇が続く中、エンジニア採用難で利益率が圧迫される',
      '52週高値からの下落幅が大きく、戻り売り圧力が当面続く可能性',
    ],
    verdict: 'DX投資の恩恵を地道に受けている実力派中小SIerやね。EDINET財務データでも罠なしを確認できており信頼度が高い。派手さはないけど、財務・収益ともに堅牢で半年保有の安定感は高い。コア枠の軸に据える価値あり。',
    verdictRating: 'strong_buy',
  },
  {
    rank: 2, code: '3925', name: 'ダブルスタンダード', industryCode: '5250', industry: '情報・通信業',
    price: 1395, per: 12.74, pbr: 2.96, roe: 21.4, dividendYield: 4.28, marketCap: 189,
    score: 93, deepScore: 96, trapFlag: 'normal', freshness: 'critical', irbankDate: '2026-02-13',
    equityRatio: 84.8, high52w: 1955, consecutiveDividendYears: 0, trapReasons: [],
    nextEarnings: '2026-05-22',
    revenueYoY: 18.3, opIncomeYoY: 35.7, netIncomeYoY: 32.1,
    progressRate: 86.9, avg5yProgress: 79.2,
    specialPL: null, revision: '上方修正（+7%）',
    scoreBreakdown: { catalyst: 17, momentum: 18, supply: 13, valuation: 14, downside: 15, dividend: 14 },
    positives: [
      'データクレンジング・統合基盤のニーズが急増中。DX投資の「縁の下の力持ち」として差別化されたポジション',
      'EDINET確認：自己資本比率84.8%は業界最高水準。実質無借金で金利上昇リスクゼロ。上方修正発表済み',
      'ROE 21.4%・営業利益35.7%増と業績モメンタムが加速中。PER 12.7倍・配当4.3%で割安感強い',
    ],
    risks: [
      '時価総額189億円の小型株で流動性が低く、まとまった量の買い/売りが株価を大きく動かす',
      '52週高値(1,955円)から-28.5%の位置。まだ下落トレンドが継続する可能性',
      'データ管理市場への大手参入が進めば、競争環境が急変するリスクがある',
    ],
    verdict: 'EDINET財務データで自己資本比率84.8%を確認。データ品質管理という今後ますます重要になる領域でユニークなポジションを持つ。業績の伸び方が本物で上方修正連発の可能性あり。財務の堅牢さを確認できた今、サテライト成長株として強く推す。',
    verdictRating: 'strong_buy',
  },
  {
    rank: 3, code: '4641', name: 'アルプス技研', industryCode: '9050', industry: 'サービス業',
    price: 2574, per: 12.7, pbr: 2.48, roe: 20.4, dividendYield: 4.18, marketCap: 505,
    score: 93, deepScore: 96, trapFlag: 'normal', freshness: 'critical', irbankDate: '2026-02-12',
    equityRatio: 69.5, high52w: 3170, consecutiveDividendYears: 0, trapReasons: [],
    nextEarnings: '2026-05-14',
    revenueYoY: 8.4, opIncomeYoY: 15.2, netIncomeYoY: 13.6,
    progressRate: 82.8, avg5yProgress: 77.4,
    specialPL: null, revision: null,
    scoreBreakdown: { catalyst: 16, momentum: 16, supply: 13, valuation: 14, downside: 14, dividend: 14 },
    positives: [
      'エンジニア派遣・請負の大手。製造業DX・自動化投資の加速で技術者需要が構造的に拡大中',
      'EDINET確認：自己資本比率69.5%・ROE 20.4%。高ROEと財務健全性を両立する優良株',
      'PER 12.7倍・配当4.2%・時価総額505億円と適度な流動性。中型株としてバランスが良い',
    ],
    risks: [
      '景気後退局面では製造業の設備投資削減が直撃。景気感応度がソフトウェア系より高い',
      '52週高値(3,170円)から-18.8%の位置。戻り売り圧力が想定される',
      '大手エンジニア派遣との価格競争が続く。単価維持が利益率の鍵',
    ],
    verdict: 'エンジニア不足・製造DXの波に乗る実力派派遣株やな。EDINET財務データで健全性確認済み。PER13倍以下で配当4%超なら半年保有でも十分なリターンが見込める。コア枠に入れて安定的に保有したい銘柄やで。',
    verdictRating: 'buy',
  },
  {
    rank: 4, code: '9416', name: 'ビジョン', industryCode: '5250', industry: '情報・通信業',
    price: 1142, per: 12.4, pbr: 2.64, roe: 23.06, dividendYield: 5.0, marketCap: 562,
    score: 93, deepScore: 96, trapFlag: 'normal', freshness: 'critical', irbankDate: '2026-02-13',
    equityRatio: 69.2, high52w: 1343, consecutiveDividendYears: 0, trapReasons: [],
    nextEarnings: '2026-05-14',
    revenueYoY: 12.1, opIncomeYoY: 24.3, netIncomeYoY: 21.8,
    progressRate: 84.6, avg5yProgress: 78.2,
    specialPL: null, revision: '上方修正（+4%）',
    scoreBreakdown: { catalyst: 17, momentum: 17, supply: 13, valuation: 14, downside: 14, dividend: 15 },
    positives: [
      'グローバルWiFi・法人向けモバイル通信が主力。海外渡航の回復と法人DX需要が同時追い風',
      'EDINET確認：自己資本比率69.2%・ROE 23.06%。高収益・高財務健全性のバランスが優秀',
      '配当利回り5.0%はセクター内でも上位水準。52週高値(1,343円)から-15%と押し目圏',
    ],
    risks: [
      '為替リスク：円高進行でグローバルWiFiの海外売上が目減りする可能性',
      '通信キャリア各社のeSIM普及加速が、レンタルWiFi需要を中期的に侵食するリスク',
      '法人向けサービスの大型案件依存度が高く、解約・更新時期に売上が変動しやすい',
    ],
    verdict: '海外渡航回復と法人DXの2大テーマに直接乗れる銘柄やで。EDINET財務データで安定性確認済み。配当5%×上方修正期待の組み合わせは半年運用に最適やな。eSIMリスクは中期のテーマで短期は問題なし。コア枠候補として強く推す。',
    verdictRating: 'strong_buy',
  },
];

export const portfolioPositions: PortfolioPosition[] = [
  {
    code: '3771', name: 'システムリサーチ', allocation: 25, type: 'core',
    buyPrice: 1733, currentPrice: 1733, shares: 150,
    verdict: 'コア軸。製造業DX需要の恩恵を受ける安定SIer。EDINET確認済み自己資本比率67.3%',
    verdictRating: 'strong_buy',
  },
  {
    code: '3925', name: 'ダブルスタンダード', allocation: 25, type: 'core',
    buyPrice: 1395, currentPrice: 1395, shares: 180,
    verdict: 'コア軸。自己資本比率84.8%（EDINET確認）。データ管理領域の差別化プレイヤー。上方修正済み',
    verdictRating: 'strong_buy',
  },
  {
    code: '9416', name: 'ビジョン', allocation: 25, type: 'core',
    buyPrice: 1142, currentPrice: 1142, shares: 220,
    verdict: 'コア軸。グローバルWiFi＋法人DXの2テーマ。配当5%・上方修正期待。EDINET確認済み',
    verdictRating: 'strong_buy',
  },
  {
    code: '4641', name: 'アルプス技研', allocation: 10, type: 'satellite',
    buyPrice: 2574, currentPrice: 2574, shares: 40,
    verdict: 'サテライト。エンジニア派遣大手。ROE20%・配当4.2%。自己資本比率69.5%（EDINET確認）',
    verdictRating: 'buy',
  },
  {
    code: '2410', name: 'キャリアデザインセンター', allocation: 10, type: 'satellite',
    buyPrice: 2459, currentPrice: 2459, shares: 40,
    verdict: 'サテライト成長枠。ROE27%・配当5.1%のスモールキャップ優良株。上方修正期待',
    verdictRating: 'buy',
  },
  {
    code: 'CASH', name: '現金ポジション', allocation: 5, type: 'cash',
    buyPrice: 0, currentPrice: 0, shares: 0,
    verdict: 'リバランス・追加買い用キャッシュ',
    verdictRating: 'watch',
  },
];
