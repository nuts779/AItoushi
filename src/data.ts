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
export const weatherDetail = 'AI・半導体主導で景気は堅調だが、原油高と金利上昇が重し';

// マクロ分析のメタ情報
// latestArticleDate: 参考にした記事の中で最新の日付
// Claude Code がマクロ分析を更新する際、economistReports と一緒に更新する
export const macroMeta = {
  latestArticleDate: '2026-09-03',
};

export const economistReports: EconomistReport[] = [
  {
    name: '藤代 宏一',
    org: '第一生命経済研究所',
    role: 'チーフエコノミスト',
    url: 'https://www.dlri.co.jp/members/fujishiro.html',
    topics: [
      '8月ISM製造業景況指数は54.6へ1.0pt低下したが50を有意に上回り、製造業の強さを印象付けた。',
      'データセンター投資が製造業に恩恵をもたらし、9月1〜2日発表の米経済指標は何れも底堅くリスク性資産にポジティブだった。',
      '日本の10年金利が3%を突破し、背景は海外金利上昇・日銀利上げ観測・財政政策への反応の3要素に大別される。',
      'AIバブル測定器として注視する韓国の8月ドル建て輸出は前年比+68.7%、半導体は同+209.1%と垂直的な伸びを記録した。',
    ],
    date: '2026-09-03',
  },
  {
    name: '木内 登英',
    org: 'NRI',
    role: 'エグゼクティブ・エコノミスト',
    url: 'https://www.nri.com/jp/media/column/kiuchi/index.html',
    topics: [
      '内閣改造と自民党役員人事が金融市場の注目点となり、政策への影響が論点となっている。',
      '日銀の利上げペースは加速する見通しである。',
      '米国のイラン攻撃再開により原油価格が90ドル台に達した。',
      '米国頼みの原油代替調達には限界がある可能性を指摘している。',
    ],
    date: '2026-09-03',
  },
  {
    name: '武者 陵司',
    org: '武者リサーチ',
    role: '代表',
    url: 'https://www.musha.co.jp/',
    topics: [
      '日本株の突出したパフォーマンスは高市政権の積極財政による潜在成長率押し上げ期待に依拠しており、高市改革の実現可能性が高まった。',
      '2027年以降、消費税減税・資産効果・円安と米中デカップリングによる国内投資復活・AI革命と日本半導体投資復活などで成長率が顕著に上昇する。',
      '足元の円安は財政不安ストーリーに投機筋が乗じたもので、日米協調介入によりドル円160円のシーリングが形成される可能性が強い。',
      '円安が止まれば利上げの必要性も消え、日本の長期金利は3%弱で安定し、高市政権の積極的経済政策はやり易くなる。',
    ],
    date: '2026-08-19',
  },
];

export const targetSectors: TargetSector[] = [
  { code: '3650', name: '電気機器', reason: '韓国8月半導体輸出が前年比+209.1%と垂直的に伸び、AI革命と日本の半導体投資大復活が指摘されているため。' },
  { code: '5250', name: '情報・通信業', reason: 'データセンター投資の拡大がAI関連需要の中核として景況を押し上げていると指摘されているため。' },
  { code: '3600', name: '機械', reason: 'データセンター投資が製造業に恩恵をもたらし、円安と米中デカップリングによる日本国内投資の復活が見込まれるため。' },
  { code: '7050', name: '銀行業', reason: '日銀が9月に政策金利1.25%、27年末までに2.25%へ利上げし、10年金利が3%を突破する金利上昇局面にあるため。' },
  { code: '1050', name: '鉱業', reason: '米国のイラン攻撃再開で原油価格が90ドル台に達し、2026年3月以降の原油高が続いているため。' },
];

export const avoidSectors: AvoidSector[] = [
  { name: '海運業', reason: '原油価格が90ドル台に達し燃料コストが上昇するうえ、米中デカップリングが貿易フローの逆風となるため。' },
  { name: '電気・ガス業', reason: '原油高と金利上昇が燃料調達コストと資金調達コストの双方を押し上げるため。' },
  { name: '不動産業', reason: '日本の10年金利が3%を突破し日銀の利上げペースも加速する見通しで、金利上昇が最も重い負担となるため。' },
  { name: '小売業', reason: '原油高による物価上昇圧力が続く一方、食品消費税減税の効果は来年4月からで足元の追い風にならないため。' },
];

// スクリーニング対象業種は targetSectors（最新マクロで絞り込んだ業種）から自動生成する。
// マクロ分析を更新すると targetSectors が変わり、このコマンドの --industries も自動で追従する。
export const targetIndustryCodes = targetSectors.map((s) => s.code).join(',');
export const generatedCommand =
  `python3 scripts/fetch_stocks.py --industries ${targetIndustryCodes} --preset stable_defensive --top 15`;

export const pipelineMeta = {
  runDate: '2026-09-01',
  priceSource: 'yfinance（当日終値・補助）',
  fundamentalSource: 'EDINET DB（公式XBRL・毎日8時更新）',
  edinetCount: 40,
  unavailableCount: 0,
  // データが古い場合に警告するしきい値（日数）
  staleWarnDays: 7,
  staleAlertDays: 30,
  preset: 'stable_defensive',
  universeCount: 872,
  stage1Count: 263,
  deepCount: 40,
  priceDate: '2026-09-04',
  priceFailedCount: 0,
};

// JPX実データ（取得日: 2026-09-04）
// rank は deepScore 降順で付番
export const screeningStocks: Stock[] = [
  {
    rank: 1, code: '6331', name: '三菱化工機', industryCode: '3600', industry: '機械',
    price: 3205.0, per: 9.67, pbr: 1.62, roe: 20.04, dividendYield: 3.76, marketCap: 730,
    score: 93, deepScore: 93, trapFlag: 'normal', freshness: 'normal', irbankDate: '2026-07-31',
    equityRatio: 57.5, high52w: 4180.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 20, supply: null, valuation: 13, downside: 11, dividend: 9 },
  },
  {
    rank: 2, code: '6915', name: '千代田インテグレ', industryCode: '3650', industry: '電気機器',
    price: 3395.0, per: 7.97, pbr: 0.74, roe: 10.14, dividendYield: 4.68, marketCap: 286,
    score: 89, deepScore: 92, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-08-07',
    equityRatio: 80.1, high52w: 3550.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 0, supply: null, valuation: 15, downside: 15, dividend: 11 },
  },
  {
    rank: 3, code: '7296', name: 'エフ・シー・シー', industryCode: '3700', industry: '輸送用機器',
    price: 4175.0, per: 10.77, pbr: 0.97, roe: 10.19, dividendYield: 4.24, marketCap: 1981,
    score: 89, deepScore: 92, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-08-04',
    equityRatio: 77.5, high52w: 4330.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 10, supply: null, valuation: 15, downside: 15, dividend: 11 },
  },
  {
    rank: 4, code: '2674', name: 'ハードオフコーポレーション', industryCode: '6100', industry: '小売業',
    price: 2607.0, per: 14.4, pbr: 1.82, roe: 18.21, dividendYield: 3.41, marketCap: 363,
    score: 88, deepScore: 91, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-08-06',
    equityRatio: 63.9, high52w: 3095.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 12, supply: null, valuation: 13, downside: 13, dividend: 9 },
  },
  {
    rank: 5, code: '6223', name: '西部技研', industryCode: '3600', industry: '機械',
    price: 1918.0, per: 8.37, pbr: 1.13, roe: 15.21, dividendYield: 3.7, marketCap: 373,
    score: 88, deepScore: 91, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-08-07',
    equityRatio: 66.6, high52w: 2650.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 9, supply: null, valuation: 14, downside: 13, dividend: 9 },
  },
  {
    rank: 6, code: '6436', name: 'アマノ', industryCode: '3600', industry: '機械',
    price: 3969.0, per: 13.86, pbr: 2.1, roe: 15.39, dividendYield: 6.28, marketCap: 2749,
    score: 88, deepScore: 91, trapFlag: 'normal', freshness: 'normal', irbankDate: '2026-07-28',
    equityRatio: 71.8, high52w: 4456.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 8, supply: null, valuation: 11, downside: 15, dividend: 12 },
  },
  {
    rank: 7, code: '7419', name: 'ノジマ', industryCode: '6100', industry: '小売業',
    price: 1253.0, per: 10.01, pbr: 1.42, roe: 21.11, dividendYield: 1.59, marketCap: 3664,
    score: 89, deepScore: 89, trapFlag: 'normal', freshness: 'normal', irbankDate: '2026-07-30',
    equityRatio: 40.8, high52w: 1607.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 17, supply: null, valuation: 14, downside: 8, dividend: 3 },
  },
  {
    rank: 8, code: '6365', name: '電業社機械製作所', industryCode: '3600', industry: '機械',
    price: 5620.0, per: 8.91, pbr: 0.75, roe: 10.16, dividendYield: 3.38, marketCap: 233,
    score: 86, deepScore: 89, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-08-07',
    equityRatio: 73.5, high52w: 6320.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 11, supply: null, valuation: 15, downside: 15, dividend: 9 },
  },
  {
    rank: 9, code: '6381', name: 'アネスト岩田', industryCode: '3600', industry: '機械',
    price: 1990.0, per: 14.63, pbr: 1.56, roe: 12.19, dividendYield: 4.46, marketCap: 768,
    score: 86, deepScore: 89, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-08-10',
    equityRatio: 68.0, high52w: 1992.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 13, supply: null, valuation: 13, downside: 13, dividend: 11 },
  },
  {
    rank: 10, code: '6417', name: 'ＳＡＮＫＹＯ', industryCode: '3600', industry: '機械',
    price: 2025.0, per: 9.01, pbr: 1.61, roe: 14.41, dividendYield: 4.93, marketCap: 4000,
    score: 86, deepScore: 89, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-08-06',
    equityRatio: 86.5, high52w: 3044.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 0, supply: null, valuation: 13, downside: 15, dividend: 11 },
  },
  {
    rank: 11, code: '6328', name: '荏原実業', industryCode: '3600', industry: '機械',
    price: 2387.0, per: 12.38, pbr: 1.72, roe: 15.84, dividendYield: 3.13, marketCap: 561,
    score: 88, deepScore: 88, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-08-05',
    equityRatio: 57.7, high52w: 2985.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 19, supply: null, valuation: 13, downside: 11, dividend: 9 },
  },
  {
    rank: 12, code: '7606', name: 'ユナイテッドアローズ', industryCode: '6100', industry: '小売業',
    price: 2400.0, per: 10.84, pbr: 1.57, roe: 16.91, dividendYield: 3.86, marketCap: 643,
    score: 88, deepScore: 88, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-08-07',
    equityRatio: 58.9, high52w: 2756.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 16, supply: null, valuation: 13, downside: 11, dividend: 9 },
  },
  {
    rank: 13, code: '7134', name: 'アップガレージグループ', industryCode: '6100', industry: '小売業',
    price: 1357.0, per: 13.76, pbr: 2.14, roe: 18.31, dividendYield: 3.17, marketCap: 108,
    score: 85, deepScore: 88, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-08-03',
    equityRatio: 69.4, high52w: 1516.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 6, supply: null, valuation: 11, downside: 13, dividend: 9 },
  },
  {
    rank: 14, code: '3020', name: 'アプライド', industryCode: '6100', industry: '小売業',
    price: 4355.0, per: 5.19, pbr: 0.84, roe: 17.65, dividendYield: 3.24, marketCap: 118,
    score: 84, deepScore: 87, trapFlag: 'normal', freshness: 'fresh', irbankDate: '2026-08-07',
    equityRatio: 62.7, high52w: 4765.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 15, supply: null, valuation: 13, downside: 13, dividend: 9 },
  },
  {
    rank: 15, code: '6159', name: 'ミクロン精密', industryCode: '3600', industry: '機械',
    price: 1890.0, per: 13.41, pbr: 0.61, roe: 6.6, dividendYield: 0, marketCap: 86,
    score: 84, deepScore: 87, trapFlag: 'normal', freshness: 'normal', irbankDate: '2026-07-13',
    equityRatio: 87.4, high52w: 2916.0, consecutiveDividendYears: 0, trapReasons: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 20, supply: null, valuation: 15, downside: 15, dividend: 12 },
  },
];

// EDINET DB / IRBANK から取得した財務詳細データ（上位15社）
// fetchDate: 取得実行日, annual: 有報ベース年次, latest: 直近決算短信
export const edinetDetails: EdinetDetail[] = [
  {
    code: '6331', name: '三菱化工機', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2026, annualEquityRatio: 57.5, annualROE: 18.2, annualNetIncome: 75.5, annualOrdinaryIncome: 94.6, annualRevenue: 842.4,
    latestQuarter: 1, latestDisclosureDate: '2026-07-31', latestEquityRatio: null,
    latestNetIncome: 1942.0, latestNetIncomeChange: null, forecastNetIncome: 6850, forecastNetIncomeChange: -9.2,
  },
  {
    code: '6915', name: '千代田インテグレ', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2025, annualEquityRatio: 80.1, annualROE: 6.4, annualNetIncome: 26.2, annualOrdinaryIncome: 32.8, annualRevenue: 380.4,
    latestQuarter: 2, latestDisclosureDate: '2026-08-07', latestEquityRatio: null,
    latestNetIncome: 2071.0, latestNetIncomeChange: null, forecastNetIncome: 3500, forecastNetIncomeChange: 33.4,
  },
  {
    code: '7296', name: 'エフ・シー・シー', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2026, annualEquityRatio: 77.5, annualROE: 9.6, annualNetIncome: 187.6, annualOrdinaryIncome: null, annualRevenue: 2608.4,
    latestQuarter: 1, latestDisclosureDate: '2026-08-04', latestEquityRatio: null,
    latestNetIncome: 5814.0, latestNetIncomeChange: null, forecastNetIncome: 17000, forecastNetIncomeChange: -9.4,
  },
  {
    code: '2674', name: 'ハードオフコーポレーション', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2026, annualEquityRatio: 63.9, annualROE: 13.1, annualNetIncome: 25.2, annualOrdinaryIncome: 34.9, annualRevenue: 392.8,
    latestQuarter: 1, latestDisclosureDate: '2026-08-06', latestEquityRatio: null,
    latestNetIncome: 1456.0, latestNetIncomeChange: null, forecastNetIncome: 3300, forecastNetIncomeChange: 31.0,
  },
  {
    code: '6223', name: '西部技研', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2025, annualEquityRatio: 66.6, annualROE: 11.1, annualNetIncome: 34.5, annualOrdinaryIncome: 44.9, annualRevenue: 343.2,
    latestQuarter: 2, latestDisclosureDate: '2026-08-07', latestEquityRatio: null,
    latestNetIncome: 2555.0, latestNetIncomeChange: null, forecastNetIncome: 3870, forecastNetIncomeChange: 12.0,
  },
  {
    code: '6436', name: 'アマノ', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2026, annualEquityRatio: 71.8, annualROE: 14.7, annualNetIncome: 201.5, annualOrdinaryIncome: 243.6, annualRevenue: 1764.7,
    latestQuarter: 1, latestDisclosureDate: '2026-07-28', latestEquityRatio: null,
    latestNetIncome: 819.0, latestNetIncomeChange: null, forecastNetIncome: 17600, forecastNetIncomeChange: -12.6,
  },
  {
    code: '7419', name: 'ノジマ', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2026, annualEquityRatio: 40.8, annualROE: 17.5, annualNetIncome: 389.3, annualOrdinaryIncome: 623.0, annualRevenue: 9828.0,
    latestQuarter: 1, latestDisclosureDate: '2026-07-30', latestEquityRatio: 43.0,
    latestNetIncome: 20515.0, latestNetIncomeChange: 100.0, forecastNetIncome: 48000, forecastNetIncomeChange: 23.3,
  },
  {
    code: '6365', name: '電業社機械製作所', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2026, annualEquityRatio: 73.5, annualROE: 8.9, annualNetIncome: 26.1, annualOrdinaryIncome: 36.4, annualRevenue: 281.9,
    latestQuarter: 1, latestDisclosureDate: '2026-08-07', latestEquityRatio: null,
    latestNetIncome: 627.0, latestNetIncomeChange: null, forecastNetIncome: 2550, forecastNetIncomeChange: -2.5,
  },
  {
    code: '6381', name: 'アネスト岩田', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2026, annualEquityRatio: 68.0, annualROE: 11.0, annualNetIncome: 53.6, annualOrdinaryIncome: 77.2, annualRevenue: 559.1,
    latestQuarter: 1, latestDisclosureDate: '2026-08-10', latestEquityRatio: null,
    latestNetIncome: 1137.0, latestNetIncomeChange: null, forecastNetIncome: 3950, forecastNetIncomeChange: -26.3,
  },
  {
    code: '6417', name: 'ＳＡＮＫＹＯ', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2026, annualEquityRatio: 86.5, annualROE: 17.6, annualNetIncome: 467.5, annualOrdinaryIncome: 639.9, annualRevenue: 1792.1,
    latestQuarter: 1, latestDisclosureDate: '2026-08-06', latestEquityRatio: null,
    latestNetIncome: 8074.0, latestNetIncomeChange: null, forecastNetIncome: 40000, forecastNetIncomeChange: -14.4,
  },
  {
    code: '6328', name: '荏原実業', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2025, annualEquityRatio: 57.7, annualROE: 17.1, annualNetIncome: 43.8, annualOrdinaryIncome: 63.2, annualRevenue: 412.1,
    latestQuarter: 2, latestDisclosureDate: '2026-08-05', latestEquityRatio: null,
    latestNetIncome: 2675.0, latestNetIncomeChange: null, forecastNetIncome: 4500, forecastNetIncomeChange: 2.6,
  },
  {
    code: '7606', name: 'ユナイテッドアローズ', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2026, annualEquityRatio: 58.9, annualROE: 15.3, annualNetIncome: 61.1, annualOrdinaryIncome: 93.1, annualRevenue: 1646.0,
    latestQuarter: 1, latestDisclosureDate: '2026-08-07', latestEquityRatio: null,
    latestNetIncome: 2119.0, latestNetIncomeChange: null, forecastNetIncome: 6175, forecastNetIncomeChange: 1.0,
  },
  {
    code: '7134', name: 'アップガレージグループ', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2026, annualEquityRatio: 69.4, annualROE: 16.0, annualNetIncome: 7.8, annualOrdinaryIncome: 11.3, annualRevenue: 153.8,
    latestQuarter: 1, latestDisclosureDate: '2026-08-03', latestEquityRatio: null,
    latestNetIncome: 181.0, latestNetIncomeChange: null, forecastNetIncome: 910, forecastNetIncomeChange: 16.5,
  },
  {
    code: '3020', name: 'アプライド', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2026, annualEquityRatio: 62.7, annualROE: 17.7, annualNetIncome: 22.7, annualOrdinaryIncome: 34.7, annualRevenue: 480.1,
    latestQuarter: 1, latestDisclosureDate: '2026-08-07', latestEquityRatio: 64.3,
    latestNetIncome: 440.0, latestNetIncomeChange: 11.2, forecastNetIncome: 2150, forecastNetIncomeChange: -5.2,
  },
  {
    code: '6159', name: 'ミクロン精密', dataSource: 'edinet_db', fetchDate: '2026-09-04',
    fiscalYear: 2025, annualEquityRatio: 87.4, annualROE: 5.9, annualNetIncome: 7.8, annualOrdinaryIncome: 11.2, annualRevenue: 57.8,
    latestQuarter: 3, latestDisclosureDate: '2026-07-13', latestEquityRatio: 83.3,
    latestNetIncome: 609.0, latestNetIncomeChange: 27.3, forecastNetIncome: 452, forecastNetIncomeChange: -42.2,
  },
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
