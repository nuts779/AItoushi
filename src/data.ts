import type {
  EconomistReport,
  TargetSector,
  AvoidSector,
  Stock,
  PortfolioPosition,
  EdinetDetail,
} from './types';

export const weather = '晴れ' as const;
export const weatherDetail = 'AI関連需要が牽引し株高継続、利上げ進行と円安・物価上昇が重し';

// マクロ分析のメタ情報
// latestArticleDate: 参考にした記事の中で最新の日付
// generatedDate:     この分析を実行した日（記事が新しくても分析が古いことがあるため別に持つ）
// どちらも vite-plugin-macro.ts が economistReports と一緒に書き換える
export const macroMeta = {
  latestArticleDate: '2026-09-25',
  generatedDate: '2026-09-26',
};

export const economistReports: EconomistReport[] = [
  {
    name: '藤代 宏一',
    org: '第一生命経済研究所',
    role: 'チーフエコノミスト',
    url: 'https://www.dlri.co.jp/members/fujishiro.html',
    topics: [
      '8月の台湾輸出受注は前年比+71.4%と加速し、単月で初めて1,000億ドルを突破した。',
      'ICT製品が同+100.5%、電子部品が同+83.9%と伸び、米国向けはデータセンター建設需要で同+88.9%と急増した。',
      '日経平均は先行き12ヶ月で72,000円程度、日銀は12月に1.5%、27年末までに2.25%まで利上げするとみる。',
      '9月会合で日銀は政策金利を1.25%へ引き上げたが、浅田・佐藤委員が経済・物価の基調の弱さを理由に反対票を投じた。',
    ],
    date: '2026-09-24',
  },
  {
    name: '木内 登英',
    org: 'NRI',
    role: 'エグゼクティブ・エコノミスト',
    url: 'https://www.nri.com/jp/media/column/kiuchi/index.html',
    topics: [
      '10月も広範囲な値上げの動きが続くと指摘している。',
      '米中首脳会談では貿易を巡る議論が注目点になるとみている。',
      '中国による米国産原油の輸入拡大が、日本の原油代替調達に悪影響を及ぼす可能性がある。',
      '日銀総裁記者会見は政策の局面変化を示したが、大幅利上げ・連続利上げには慎重とみられる。',
    ],
    date: '2026-09-25',
  },
  {
    name: '武者 陵司',
    org: '武者リサーチ',
    role: '代表',
    url: 'https://www.musha.co.jp/',
    topics: [
      '人類は土地・資本・労働に代わりAIが富を生む「AI革命」の時代に入ったとみる。',
      '米国覇権に対する中国の挑戦がAI時代と重なり、体制間闘争として調整が困難になっている。',
      '日本の10年国債利回りは9月1日に30年ぶりに3%を突破したが、GDP成長率やコアコアCPIなどファンダメンタルズは伴っていない。',
      '消費税減税・資産効果・国内投資復活・骨太方針・AI革命と半導体投資により、2027年以降の日本の成長率上昇を予想する。',
    ],
    date: '2026-09-16',
  },
];

export const targetSectors: TargetSector[] = [
  { code: '3650', name: '電気機器', reason: '台湾の輸出受注でICT製品が前年比+100.5%、電子部品が+83.9%と急伸し、AI・半導体需要の拡大が続いているため。' },
  { code: '5250', name: '情報・通信業', reason: '武者氏がAIが富を生む「AI革命」の時代に入ったと指摘し、データセンター需要の拡大が確認されているため。' },
  { code: '3600', name: '機械', reason: 'AI革命と日本の半導体投資大復活、円安と米中デカップリングによる国内投資の復活が好要因として挙げられているため。' },
  { code: '7050', name: '銀行業', reason: '日銀が政策金利を1.25%へ引き上げ、12月に1.5%、27年末までに2.25%への利上げが見込まれ、10年国債利回りも3%を突破しているため。' },
  { code: '2050', name: '建設業', reason: 'データセンター建設の増加に伴う需要が米国向け受注を押し上げており、2040年370兆円の骨太方針の本格始動も控えるため。' },
];

export const avoidSectors: AvoidSector[] = [
  { name: '小売業', reason: '10月も広範囲な値上げが続き、7月の実質家計消費が-3.6%と8か月連続で前年割れするなど消費の低迷が解決していないため。' },
  { name: '不動産業', reason: '日銀の連続利上げと10年国債利回りの3%突破により、金利上昇が重しとなるため。' },
  { name: '石油・石炭製品', reason: '中国による米国産原油の輸入拡大が日本の原油代替調達に悪影響を及ぼす可能性が指摘されているため。' },
  { name: '食料品', reason: '広範囲な値上げが続く一方で実質家計消費が8か月連続で前年割れしており、来年4月の食品消費税減税まで需要の回復が見込みにくいため。' },
];

// スクリーニング対象業種は targetSectors（最新マクロで絞り込んだ業種）から自動生成する。
// マクロ分析を更新すると targetSectors が変わり、このコマンドの --industries も自動で追従する。
export const targetIndustryCodes = targetSectors.map((s) => s.code).join(',');

// コマンドの「引数部分だけ」を持つ。Python の実行コマンド名（python / python3）は
// ここに焼き込まない。data.ts は片方の OS で生成したものを両メンバーが共有するため、
// コマンド名を含めると受け取った側の画面で必ず嘘になる（BUG-019）。
// 実行コマンド名は表示時に pythonCommand.tsx がサーバ（自分の npm run dev）へ問い合わせる。
export const screeningCommandArgs =
  `scripts/fetch_stocks.py --industries ${targetIndustryCodes} --preset stable_defensive --top 15`;

export const pipelineMeta = {
  runDate: '2026-09-26',
  priceSource: 'yfinance（当日終値・補助）',
  fundamentalSource: 'EDINET DB（公式XBRL・毎日8時更新）',
  edinetCount: 40,
  unavailableCount: 0,
  // データが古い場合に警告するしきい値（日数）
  staleWarnDays: 7,
  staleAlertDays: 30,
  preset: 'stable_defensive',
  // スクリーニング時に対象とした33業種コード。
  // マクロ分析が推す業種（targetSectors）は後から単独で更新されるため、
  // 画面側で突き合わせて「選定の前提が古い」ことを検知する。
  screenedIndustries: [3650, 5250, 3600, 7050, 2050],
  universeCount: 993,
  stage1Count: 374,
  deepCount: 40,
  priceDate: '2026-09-25',
  priceFailedCount: 0,
};

// JPX実データ（スクリーニング実行日: 2026-09-26）
// rank は deepScore 降順で付番
export const screeningStocks: Stock[] = [
  {
    rank: 1, code: '1787', name: 'ナカボーテック', industryCode: '2050', industry: '建設業',
    price: 5600.0, per: 11.57, pbr: 1.67, roe: 15.07, dividendYield: 4.64, marketCap: 121,
    score: 91, deepScore: 94, trapFlag: 'normal', irbankDate: '2026-08-03',
    equityRatio: 77.0, high52w: 6750.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 借入金がXBRLにタグ付けされていない', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 8, supply: null, valuation: 13, downside: 15, dividend: 11 },
  },
  {
    rank: 2, code: '3817', name: 'ＳＲＡホールディングス', industryCode: '5250', industry: '情報・通信業',
    price: 4855.0, per: 10.95, pbr: 1.78, roe: 17.53, dividendYield: 4.94, marketCap: 654,
    score: 91, deepScore: 94, trapFlag: 'normal', irbankDate: '2026-08-12',
    equityRatio: 64.7, high52w: 5870.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 2項目が未タグ付けで合計を確定できない（取得できたぶんではD/E 0.00倍）', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 17, supply: null, valuation: 13, downside: 13, dividend: 11 },
  },
  {
    rank: 3, code: '3922', name: 'ＰＲ　ＴＩＭＥＳ', industryCode: '5250', industry: '情報・通信業',
    price: 2185.0, per: 12.52, pbr: 3.1, roe: 28.76, dividendYield: 0, marketCap: 296,
    score: 91, deepScore: 94, trapFlag: 'normal', irbankDate: '2026-07-14',
    equityRatio: 78.9, high52w: 3245.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['在庫の急増: 前期比を出せる2期ぶんの在庫が無い', '有利子負債の水準: 借入金がXBRLにタグ付けされていない'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 20, supply: null, valuation: 9, downside: 15, dividend: 12 },
  },
  {
    rank: 4, code: '9709', name: 'ＮＣＳ＆Ａ', industryCode: '5250', industry: '情報・通信業',
    price: 1274.0, per: 9.62, pbr: 1.39, roe: 15.29, dividendYield: 4.55, marketCap: 189,
    score: 91, deepScore: 94, trapFlag: 'normal', irbankDate: '2026-07-30',
    equityRatio: 64.8, high52w: 1778.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 借入金がXBRLにタグ付けされていない', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 9, supply: null, valuation: 14, downside: 13, dividend: 11 },
  },
  {
    rank: 5, code: '4783', name: 'ＮＣＤ', industryCode: '5250', industry: '情報・通信業',
    price: 2628.0, per: 11.54, pbr: 2.62, roe: 23.99, dividendYield: 4.57, marketCap: 211,
    score: 93, deepScore: 93, trapFlag: 'normal', irbankDate: '2026-08-07',
    equityRatio: 50.1, high52w: 3550.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 2項目が未タグ付けで合計を確定できない（取得できたぶんではD/E 0.09倍）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 2, supply: null, valuation: 11, downside: 11, dividend: 11 },
  },
  {
    rank: 6, code: '2307', name: 'クロスキャット', industryCode: '5250', industry: '情報・通信業',
    price: 1070.0, per: 9.92, pbr: 2.32, roe: 25.49, dividendYield: 3.64, marketCap: 150,
    score: 90, deepScore: 93, trapFlag: 'normal', irbankDate: '2026-08-05',
    equityRatio: 61.4, high52w: 1238.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['在庫の急増: 前期比を出せる2期ぶんの在庫が無い', '有利子負債の水準: 2項目が未タグ付けで合計を確定できない（取得できたぶんではD/E 0.11倍）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 12, supply: null, valuation: 11, downside: 13, dividend: 9 },
  },
  {
    rank: 7, code: '3901', name: 'マークラインズ', industryCode: '5250', industry: '情報・通信業',
    price: 1506.0, per: 12.36, pbr: 2.73, roe: 22.6, dividendYield: 3.45, marketCap: 192,
    score: 90, deepScore: 93, trapFlag: 'normal', irbankDate: '2026-08-04',
    equityRatio: 74.2, high52w: 2121.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 借入金がXBRLにタグ付けされていない', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 2, supply: null, valuation: 11, downside: 15, dividend: 9 },
  },
  {
    rank: 8, code: '3921', name: 'ネオジャパン', industryCode: '5250', industry: '情報・通信業',
    price: 1687.0, per: 12.65, pbr: 2.95, roe: 25.12, dividendYield: 3.2, marketCap: 236,
    score: 90, deepScore: 93, trapFlag: 'normal', irbankDate: '2026-09-10',
    equityRatio: 69.9, high52w: 1983.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['売上債権の急増: 前期比を出せる2期ぶんの売上債権が無い', '有利子負債の水準: 借入金がXBRLにタグ付けされていない'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 17, supply: null, valuation: 11, downside: 13, dividend: 9 },
  },
  {
    rank: 9, code: '6915', name: '千代田インテグレ', industryCode: '3650', industry: '電気機器',
    price: 3585.0, per: 8.42, pbr: 0.78, roe: 10.14, dividendYield: 4.46, marketCap: 302,
    score: 89, deepScore: 92, trapFlag: 'normal', irbankDate: '2026-08-07',
    equityRatio: 80.1, high52w: 3595.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 2項目が未タグ付けで合計を確定できない（取得できたぶんではD/E 0.03倍）', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 0, supply: null, valuation: 15, downside: 15, dividend: 11 },
  },
  {
    rank: 10, code: '1952', name: '新日本空調', industryCode: '2050', industry: '建設業',
    price: 3230.0, per: 12.09, pbr: 1.81, roe: 17.75, dividendYield: 3.72, marketCap: 1471,
    score: 88, deepScore: 91, trapFlag: 'normal', irbankDate: '2026-08-07',
    equityRatio: 61.0, high52w: 4400.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 18, supply: null, valuation: 13, downside: 13, dividend: 9 },
  },
  {
    rank: 11, code: '2359', name: 'コア', industryCode: '5250', industry: '情報・通信業',
    price: 2118.0, per: 10.57, pbr: 1.47, roe: 15.18, dividendYield: 3.07, marketCap: 304,
    score: 88, deepScore: 91, trapFlag: 'normal', irbankDate: '2026-07-29',
    equityRatio: 73.5, high52w: 2348.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 1項目が未タグ付けで合計を確定できない（取得できたぶんではD/E 0.08倍）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 16, supply: null, valuation: 14, downside: 15, dividend: 9 },
  },
  {
    rank: 12, code: '3854', name: 'アイル', industryCode: '5250', industry: '情報・通信業',
    price: 2152.0, per: 12.89, pbr: 3.88, roe: 33.21, dividendYield: 3.25, marketCap: 538,
    score: 88, deepScore: 91, trapFlag: 'normal', irbankDate: '2026-09-07',
    equityRatio: 71.6, high52w: 2780.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 借入金がXBRLにタグ付けされていない', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 15, supply: null, valuation: 9, downside: 15, dividend: 9 },
  },
  {
    rank: 13, code: '3983', name: 'オロ', industryCode: '5250', industry: '情報・通信業',
    price: 1904.0, per: 13.83, pbr: 2.91, roe: 21.58, dividendYield: 2.63, marketCap: 289,
    score: 88, deepScore: 91, trapFlag: 'normal', irbankDate: '2026-08-14',
    equityRatio: 75.3, high52w: 2746.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['特別利益の上乗せ: 会計基準がIFRSで経常利益の概念が無い', '在庫の急増: 前期比を出せる2期ぶんの在庫が無い', '有利子負債の水準: 借入金がXBRLにタグ付けされていない', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 3, supply: null, valuation: 11, downside: 15, dividend: 6 },
  },
  {
    rank: 14, code: '4012', name: 'アクシス', industryCode: '5250', industry: '情報・通信業',
    price: 1736.0, per: 10.32, pbr: 1.75, roe: 18.47, dividendYield: 3.28, marketCap: 75,
    score: 88, deepScore: 91, trapFlag: 'normal', irbankDate: '2026-08-06',
    equityRatio: 75.4, high52w: 1790.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['在庫の急増: 前期比を出せる2期ぶんの在庫が無い', '有利子負債の水準: 借入金がXBRLにタグ付けされていない', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 12, supply: null, valuation: 13, downside: 15, dividend: 9 },
  },
  {
    rank: 15, code: '1928', name: '積水ハウス', industryCode: '2050', industry: '建設業',
    price: 3369.0, per: 8.55, pbr: 0.97, roe: 12.26, dividendYield: 4.33, marketCap: 21845,
    score: 89, deepScore: 89, trapFlag: 'normal', irbankDate: '2026-09-10',
    equityRatio: 42.7, high52w: 3832.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: [],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 11, supply: null, valuation: 15, downside: 8, dividend: 11 },
  },
];

// EDINET DB / IRBANK から取得した財務詳細データ（上位15社）
// fetchDate: 取得実行日, annual: 有報ベース年次, latest: 直近決算短信
export const edinetDetails: EdinetDetail[] = [
  {
    code: '1787', name: 'ナカボーテック', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2026, annualEquityRatio: 77.0, annualROE: 13.1, annualNetIncome: 11.9, annualOrdinaryIncome: 13.8, annualRevenue: 149.0,
    latestQuarter: 1, latestDisclosureDate: '2026-08-03', latestEquityRatio: 79.1,
    latestNetIncome: -235.0, latestNetIncomeChange: -254.0, forecastNetIncome: 923, forecastNetIncomeChange: 22.2,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YF2C', earningsPdfUrl: 'https://www.nakabohtec.co.jp/wp-content/uploads/2026/08/2027年3月期-第1四半期決算短信〔日本基準〕（非連結）.pdf', earningsTitle: '2027年3月期 第1四半期決算短信〔日本基準〕（非連結） [1601KB]',
  },
  {
    code: '3817', name: 'ＳＲＡホールディングス', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2026, annualEquityRatio: 64.7, annualROE: 17.4, annualNetIncome: 56.0, annualOrdinaryIncome: 95.0, annualRevenue: 532.8,
    latestQuarter: 1, latestDisclosureDate: '2026-08-12', latestEquityRatio: null,
    latestNetIncome: 1221.0, latestNetIncomeChange: null, forecastNetIncome: 5500, forecastNetIncomeChange: -1.8,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YHQM', earningsPdfUrl: 'https://www.sra-hd.co.jp/Portals/0/ir/settlement/tanshin/tanshin2608.pdf', earningsTitle: '決算短信',
  },
  {
    code: '3922', name: 'ＰＲ　ＴＩＭＥＳ', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2026, annualEquityRatio: 78.9, annualROE: 30.0, annualNetIncome: 24.0, annualOrdinaryIncome: 36.1, annualRevenue: 95.5,
    latestQuarter: 1, latestDisclosureDate: '2026-07-14', latestEquityRatio: 85.4,
    latestNetIncome: 604.0, latestNetIncomeChange: 5.6, forecastNetIncome: 2200, forecastNetIncomeChange: -8.3,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100Y6DH', earningsPdfUrl: null, earningsTitle: '2027-02',
  },
  {
    code: '9709', name: 'ＮＣＳ＆Ａ', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2026, annualEquityRatio: 64.8, annualROE: 14.7, annualNetIncome: 20.7, annualOrdinaryIncome: 28.7, annualRevenue: 224.9,
    latestQuarter: 1, latestDisclosureDate: '2026-07-30', latestEquityRatio: 62.9,
    latestNetIncome: 478.0, latestNetIncomeChange: 11.5, forecastNetIncome: 1830, forecastNetIncomeChange: -11.5,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YAMN', earningsPdfUrl: 'https://ncsa.jp/application/files/2317/8539/6696/2027-3-1stqtr-kessan-tanshin.pdf', earningsTitle: '２０２７年３月期 第１四半期決算短信 ［２０２６年７月３０日］ (約',
  },
  {
    code: '4783', name: 'ＮＣＤ', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2026, annualEquityRatio: 50.1, annualROE: 22.9, annualNetIncome: 18.6, annualOrdinaryIncome: 26.7, annualRevenue: 308.7,
    latestQuarter: 1, latestDisclosureDate: '2026-08-07', latestEquityRatio: null,
    latestNetIncome: 251.0, latestNetIncomeChange: null, forecastNetIncome: 1830, forecastNetIncomeChange: -1.7,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YEMH', earningsPdfUrl: null, earningsTitle: '2027年3月期 第1四半期決算短信〔日本基準〕(連結)',
  },
  {
    code: '2307', name: 'クロスキャット', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2026, annualEquityRatio: 61.4, annualROE: 24.2, annualNetIncome: 15.1, annualOrdinaryIncome: 20.4, annualRevenue: 173.1,
    latestQuarter: 1, latestDisclosureDate: '2026-08-05', latestEquityRatio: null,
    latestNetIncome: 325.0, latestNetIncomeChange: null, forecastNetIncome: 1540, forecastNetIncomeChange: 1.9,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YJU2', earningsPdfUrl: 'https://www.xcat.co.jp/ja/ir/news/auto_20260805509745/pdfFile.pdf', earningsTitle: '2026年08月05日 2027年３月期第１四半期決算短信〔日本基準〕(連結)',
  },
  {
    code: '3901', name: 'マークラインズ', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2025, annualEquityRatio: 74.2, annualROE: 23.1, annualNetIncome: 15.2, annualOrdinaryIncome: 21.5, annualRevenue: 55.7,
    latestQuarter: 2, latestDisclosureDate: '2026-08-04', latestEquityRatio: 72.8,
    latestNetIncome: 797.0, latestNetIncomeChange: 6.1, forecastNetIncome: 1660, forecastNetIncomeChange: 9.2,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100XSGJ', earningsPdfUrl: 'https://contents.xj-storage.jp/xcontents/AS07754/adabafd0/e5e6/4622/8dcd/d78787200240/140120260804508499.pdf', earningsTitle: null,
  },
  {
    code: '3921', name: 'ネオジャパン', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2026, annualEquityRatio: 69.9, annualROE: 26.3, annualNetIncome: 18.1, annualOrdinaryIncome: 26.1, annualRevenue: 82.3,
    latestQuarter: 2, latestDisclosureDate: '2026-09-10', latestEquityRatio: 71.3,
    latestNetIncome: 947.0, latestNetIncomeChange: 6.6, forecastNetIncome: 1876, forecastNetIncomeChange: 3.7,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100Y0W0', earningsPdfUrl: 'https://contents.xj-storage.jp/xcontents/AS97261/7efb20fb/9202/4a55/9d02/0fc43d8bdd6e/140120260910534360.pdf', earningsTitle: null,
  },
  {
    code: '6915', name: '千代田インテグレ', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2025, annualEquityRatio: 80.1, annualROE: 6.4, annualNetIncome: 26.2, annualOrdinaryIncome: 32.8, annualRevenue: 380.4,
    latestQuarter: 2, latestDisclosureDate: '2026-08-07', latestEquityRatio: null,
    latestNetIncome: 2071.0, latestNetIncomeChange: null, forecastNetIncome: 3500, forecastNetIncomeChange: 33.4,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100XT6S', earningsPdfUrl: 'https://www.chiyoda-i.co.jp/wp-content/uploads/2026/05/20260807.pdf', earningsTitle: '2026年12月期 第2四半期決算短信',
  },
  {
    code: '1952', name: '新日本空調', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2026, annualEquityRatio: 61.0, annualROE: 16.0, annualNetIncome: 121.5, annualOrdinaryIncome: 158.8, annualRevenue: 1548.8,
    latestQuarter: 1, latestDisclosureDate: '2026-08-07', latestEquityRatio: null,
    latestNetIncome: 2739.0, latestNetIncomeChange: null, forecastNetIncome: 12800, forecastNetIncomeChange: 5.3,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YDMT', earningsPdfUrl: 'https://pdf.irpocket.com/C1952/xoA3/ieAo/Bawv/aNJb.pdf', earningsTitle: '2027年3月期 第1四半期決算短信 〔日本基準〕（連結） （553KB） [553.7KB] PDF',
  },
  {
    code: '2359', name: 'コア', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2026, annualEquityRatio: 73.5, annualROE: 14.7, annualNetIncome: 28.8, annualOrdinaryIncome: 39.2, annualRevenue: 265.3,
    latestQuarter: 1, latestDisclosureDate: '2026-07-29', latestEquityRatio: 73.9,
    latestNetIncome: 593.0, latestNetIncomeChange: 18.8, forecastNetIncome: 3000, forecastNetIncomeChange: 4.2,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YE3S', earningsPdfUrl: 'https://www.core.co.jp/system/files/2026-07/ir_20260729-1.pdf', earningsTitle: '2027-03',
  },
  {
    code: '3854', name: 'アイル', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2025, annualEquityRatio: 71.6, annualROE: 33.3, annualNetIncome: 34.9, annualOrdinaryIncome: 47.7, annualRevenue: 192.9,
    latestQuarter: 4, latestDisclosureDate: '2026-09-07', latestEquityRatio: null,
    latestNetIncome: 4175.0, latestNetIncomeChange: null, forecastNetIncome: 3546, forecastNetIncomeChange: -15.1,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100WVK4', earningsPdfUrl: null, earningsTitle: '2026年7月期 決算短信〔日本基準〕（連結）',
  },
  {
    code: '3983', name: 'オロ', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2025, annualEquityRatio: 75.3, annualROE: 18.4, annualNetIncome: 19.0, annualOrdinaryIncome: null, annualRevenue: 83.1,
    latestQuarter: 2, latestDisclosureDate: '2026-08-14', latestEquityRatio: null,
    latestNetIncome: 1003.0, latestNetIncomeChange: null, forecastNetIncome: 2147, forecastNetIncomeChange: 13.2,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100XR9Z', earningsPdfUrl: 'https://contents.xj-storage.jp/xcontents/AS01398/53910bce/6d75/4be3/8f19/3883cde64efc/140120260812518396.pdf', earningsTitle: '決算短信 | 2026年12月期 第2四半期（中間期）決算短信〔IFRS〕（連結）',
  },
  {
    code: '4012', name: 'アクシス', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2025, annualEquityRatio: 75.4, annualROE: 16.8, annualNetIncome: 6.4, annualOrdinaryIncome: 9.2, annualRevenue: 81.3,
    latestQuarter: 2, latestDisclosureDate: '2026-08-06', latestEquityRatio: null,
    latestNetIncome: 376.0, latestNetIncomeChange: null, forecastNetIncome: 700, forecastNetIncomeChange: 8.9,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100XS04', earningsPdfUrl: 'https://contents.xj-storage.jp/xcontents/AS04553/ca9f2412/7e7f/4e3d/92d2/41d8cb468f70/140120260803507505.pdf', earningsTitle: '2026年12月期第２四半期（中間期）決算短信〔日本基準〕(非連結)',
  },
  {
    code: '1928', name: '積水ハウス', dataSource: 'edinet_db', fetchDate: '2026-09-26',
    fiscalYear: 2026, annualEquityRatio: 42.7, annualROE: 11.3, annualNetIncome: 2320.9, annualOrdinaryIncome: 3278.0, annualRevenue: 41979.2,
    latestQuarter: 2, latestDisclosureDate: '2026-09-10', latestEquityRatio: null,
    latestNetIncome: 125053.0, latestNetIncomeChange: null, forecastNetIncome: 224000, forecastNetIncomeChange: -3.5,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100XZ22', earningsPdfUrl: 'https://www.sekisuihouse.co.jp/company/financial/library/ir_document/2026/2026_kessan/t20260910.pdf', earningsTitle: '決算 NEW 2027年1月期 第2四半期決算短信',
  },
];

// 保有ポジション。実際に保有している銘柄をここに書く。
//
// 以前ここには4月時点のサンプル銘柄が「◎強推奨」つきで入っていたが、
//   ・買値と現在値が同じ（＝一度も保有していない架空データ）
//   ・現在のスクリーニング結果と1社も一致しない
//   ・推奨文は計算根拠のない手書き
// という状態で、画面上は本物の保有・本物の推奨と区別がつかなかったため撤去した。
//
// 追加するときの書式:
//   { code: '6331', name: '三菱化工機', allocation: 25, type: 'core',
//     buyPrice: 1733, currentPrice: 1733, shares: 150, note: '自分用のメモ' }
export const portfolioPositions: PortfolioPosition[] = [];
