import type {
  EconomistReport,
  TargetSector,
  AvoidSector,
  Stock,
  PortfolioPosition,
  EdinetDetail,
} from './types';

export const weather = '曇り' as const;
export const weatherDetail = '利上げ局面だが企業業績は堅調、AI・財政期待と金利上昇懸念が交錯';

// マクロ分析のメタ情報
// latestArticleDate: 参考にした記事の中で最新の日付
// generatedDate:     この分析を実行した日（記事が新しくても分析が古いことがあるため別に持つ）
// どちらも vite-plugin-macro.ts が economistReports と一緒に書き換える
export const macroMeta = {
  latestArticleDate: '2026-09-18',
  generatedDate: '2026-09-18',
};

export const economistReports: EconomistReport[] = [
  {
    name: '藤代 宏一',
    org: '第一生命経済研究所',
    role: 'チーフエコノミスト',
    url: 'https://www.dlri.co.jp/members/fujishiro.html',
    topics: [
      '日銀は大方の予想通り政策金利を1.25％へ引き上げ、浅田・佐藤両委員が経済・物価の基調が強くないとして反対票を投じた。',
      '2027年7月の高田・田村両委員の任期満了後の後任人事は、市場の懸念に反して中立ないしタカ派的な人選になるとみている。',
      '9月FOMCは全会一致で25bp利上げを決定しFF金利上限は4.0％、ドットチャートの中央値は年内もう1回の利上げで4.25％となった。',
      '日経平均は先行き12ヶ月で72,000円程度、日銀は2027年末までに政策金利を2.25％まで引き上げるとみる（PERは低下しEPSは伸びており今は屈伸運動の「下」）。',
    ],
    date: '2026-09-18',
  },
  {
    name: '木内 登英',
    org: 'NRI',
    role: 'エグゼクティブ・エコノミスト',
    url: 'https://www.nri.com/jp/media/column/kiuchi/index.html',
    topics: [
      '日銀総裁記者会見は政策の局面変化を指摘したが、大幅利上げ・連続利上げには慎重な姿勢とみられる。',
      '日本銀行の利上げを受けて、今後の金融政策運営の展望が焦点となっている。',
      '第2次高市改造内閣が発足し、これまでの政策姿勢が修正されるかが論点となっている。',
      '（本文要約が経歴紹介のみで、記事本文から読み取れる具体的な論点は上記タイトル水準にとどまる）',
    ],
    date: '2026-09-18',
  },
  {
    name: '武者 陵司',
    org: '武者リサーチ',
    role: '代表',
    url: 'https://www.musha.co.jp/',
    topics: [
      '人類はAIが莫大な富を生み出すAI革命の時代に入っており、土地・資本・労働力に代わる新たな価値の源泉となっている。',
      '米国の世界覇権に対する中国の挑戦がAI時代と重なり、体制間闘争・地政学リスクが調整不能な段階に入りつつある。',
      '日本の10年国債利回りが9月1日に30年ぶりに3％を突破したが、GDP成長率はG7最低水準、7月の実質家計消費は前年比-3.6％と8か月連続マイナスでファンダメンタルズに見合わない。',
      '2027年以降は消費税減税・資産効果・円安と米中デカップリングによる国内投資復活・骨太方針・AI革命と日本半導体投資の大復活により成長率が顕著に上昇する。',
    ],
    date: '2026-09-16',
  },
];

export const targetSectors: TargetSector[] = [
  { code: '5250', name: '情報・通信業', reason: '武者氏がAI革命を史上空前の大変革期と位置づけ、AIが莫大な富を生み出す時代に入ったと指摘しているため。' },
  { code: '3650', name: '電気機器', reason: '「AI革命と日本半導体投資大復活」が2027年以降の成長押し上げ要因として挙げられているため。' },
  { code: '7050', name: '銀行業', reason: '日銀が政策金利を1.25％へ引き上げ、2027年末までに2.25％へ向かう利上げ局面が続くとみられるため。' },
  { code: '7150', name: '保険業', reason: '10年国債利回りが30年ぶりに3％を突破し、国内金利水準の正常化が運用環境の改善につながるため。' },
  { code: '2050', name: '建設業', reason: '2040年370兆円の骨太の方針本格始動と円安・米中デカップリングによる日本国内投資の復活が挙げられているため。' },
];

export const avoidSectors: AvoidSector[] = [
  { name: '小売業', reason: '7月の実質家計消費が前年比-3.6％と8か月連続で前年を下回り、2014年以降の消費低迷が解決していないため。' },
  { name: '食料品', reason: 'コアコアCPIが目標の2％を大きく下回る一方、来年4月からの食品への消費税減税が控え価格転嫁環境が変わるため。' },
  { name: '不動産業', reason: '日銀の利上げが2027年末に2.25％まで継続し、長期金利が3％超へ上昇する金利上昇局面にあるため。' },
  { name: '海運業', reason: '米中の体制間闘争やウクライナ・ガザ・イランなど地政学的争乱が調整不能な段階に入りつつあるため。' },
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
  runDate: '2026-09-18',
  priceSource: 'yfinance（当日終値・補助）',
  fundamentalSource: 'EDINET DB（公式XBRL・毎日8時更新）',
  edinetCount: 39,
  unavailableCount: 1,
  // データが古い場合に警告するしきい値（日数）
  staleWarnDays: 7,
  staleAlertDays: 30,
  preset: 'stable_defensive',
  // スクリーニング時に対象とした33業種コード。
  // マクロ分析が推す業種（targetSectors）は後から単独で更新されるため、
  // 画面側で突き合わせて「選定の前提が古い」ことを検知する。
  screenedIndustries: [5250, 3650, 7050, 7150, 2050],
  universeCount: 799,
  stage1Count: 297,
  deepCount: 40,
  priceDate: '2026-09-18',
  priceFailedCount: 0,
};

// JPX実データ（スクリーニング実行日: 2026-09-18）
// rank は deepScore 降順で付番
export const screeningStocks: Stock[] = [
  {
    rank: 1, code: '1787', name: 'ナカボーテック', industryCode: '2050', industry: '建設業',
    price: 5640.0, per: 11.66, pbr: 1.68, roe: 15.07, dividendYield: 4.63, marketCap: 122,
    score: 91, deepScore: 94, trapFlag: 'normal', irbankDate: '2026-08-03',
    equityRatio: 77.0, high52w: 6750.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 借入金がXBRLにタグ付けされていない', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 8, supply: null, valuation: 13, downside: 15, dividend: 11 },
  },
  {
    rank: 2, code: '3817', name: 'ＳＲＡホールディングス', industryCode: '5250', industry: '情報・通信業',
    price: 4775.0, per: 10.77, pbr: 1.75, roe: 17.53, dividendYield: 5.01, marketCap: 643,
    score: 91, deepScore: 94, trapFlag: 'normal', irbankDate: '2026-08-12',
    equityRatio: 64.7, high52w: 5870.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 2項目が未タグ付けで合計を確定できない（取得できたぶんではD/E 0.00倍）', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 17, supply: null, valuation: 13, downside: 13, dividend: 12 },
  },
  {
    rank: 3, code: '3922', name: 'ＰＲ　ＴＩＭＥＳ', industryCode: '5250', industry: '情報・通信業',
    price: 2211.0, per: 12.65, pbr: 3.13, roe: 28.76, dividendYield: 0, marketCap: 299,
    score: 91, deepScore: 94, trapFlag: 'normal', irbankDate: '2026-07-14',
    equityRatio: 78.9, high52w: 3245.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['在庫の急増: 前期比を出せる2期ぶんの在庫が無い', '有利子負債の水準: 借入金がXBRLにタグ付けされていない'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 20, supply: null, valuation: 9, downside: 15, dividend: 12 },
  },
  {
    rank: 4, code: '9709', name: 'ＮＣＳ＆Ａ', industryCode: '5250', industry: '情報・通信業',
    price: 1224.0, per: 9.24, pbr: 1.34, roe: 15.29, dividendYield: 4.83, marketCap: 182,
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
    price: 1078.0, per: 9.99, pbr: 2.34, roe: 25.49, dividendYield: 3.57, marketCap: 151,
    score: 90, deepScore: 93, trapFlag: 'normal', irbankDate: '2026-08-05',
    equityRatio: 61.4, high52w: 1287.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['在庫の急増: 前期比を出せる2期ぶんの在庫が無い', '有利子負債の水準: 2項目が未タグ付けで合計を確定できない（取得できたぶんではD/E 0.11倍）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 12, supply: null, valuation: 11, downside: 13, dividend: 9 },
  },
  {
    rank: 7, code: '3901', name: 'マークラインズ', industryCode: '5250', industry: '情報・通信業',
    price: 1526.0, per: 12.52, pbr: 2.77, roe: 22.6, dividendYield: 3.4, marketCap: 195,
    score: 90, deepScore: 93, trapFlag: 'normal', irbankDate: '2026-08-06',
    equityRatio: 74.2, high52w: 2138.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 借入金がXBRLにタグ付けされていない', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 2, supply: null, valuation: 11, downside: 15, dividend: 9 },
  },
  {
    rank: 8, code: '3921', name: 'ネオジャパン', industryCode: '5250', industry: '情報・通信業',
    price: 1706.0, per: 12.8, pbr: 2.98, roe: 25.12, dividendYield: 3.21, marketCap: 239,
    score: 90, deepScore: 93, trapFlag: 'normal', irbankDate: '2026-09-11',
    equityRatio: 69.9, high52w: 2012.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['売上債権の急増: 前期比を出せる2期ぶんの売上債権が無い', '有利子負債の水準: 借入金がXBRLにタグ付けされていない'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 17, supply: null, valuation: 11, downside: 13, dividend: 9 },
  },
  {
    rank: 9, code: '6915', name: '千代田インテグレ', industryCode: '3650', industry: '電気機器',
    price: 3465.0, per: 8.13, pbr: 0.75, roe: 10.14, dividendYield: 4.61, marketCap: 292,
    score: 89, deepScore: 92, trapFlag: 'normal', irbankDate: '2026-08-07',
    equityRatio: 80.1, high52w: 3550.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 2項目が未タグ付けで合計を確定できない（取得できたぶんではD/E 0.03倍）', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 0, supply: null, valuation: 15, downside: 15, dividend: 11 },
  },
  {
    rank: 10, code: '500A', name: 'ＴＯブックス', industryCode: '5250', industry: '情報・通信業',
    price: 3605.0, per: 9.67, pbr: 1.69, roe: 22.72, dividendYield: 2.06, marketCap: 127,
    score: 91, deepScore: 91, trapFlag: 'normal', irbankDate: '',
    equityRatio: 50, high52w: 3880.0, consecutiveDividendYears: 0, trapReasons: ['財務データ未取得（EDINET DB未収録/失敗）'],
    trapUndetermined: ['ROE急騰: 財務データを取得できていない', 'EPS急騰: 財務データを取得できていない', '特別利益の上乗せ: 財務データを取得できていない', '赤字急回復: 財務データを取得できていない', '自己資本比率: 財務データを取得できていない', '営業CFと純利益の乖離: 財務データを取得できていない', '売上債権の急増: 財務データを取得できていない', '在庫の急増: 財務データを取得できていない', '有利子負債の水準: 財務データを取得できていない', 'のれんの規模: 財務データを取得できていない'],
    dataSource: 'unavailable',
    scoreBreakdown: undefined,
  },
  {
    rank: 11, code: '1952', name: '新日本空調', industryCode: '2050', industry: '建設業',
    price: 3240.0, per: 12.13, pbr: 1.82, roe: 17.75, dividendYield: 3.67, marketCap: 1476,
    score: 88, deepScore: 91, trapFlag: 'normal', irbankDate: '2026-08-07',
    equityRatio: 61.0, high52w: 4400.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 18, supply: null, valuation: 13, downside: 13, dividend: 9 },
  },
  {
    rank: 12, code: '2359', name: 'コア', industryCode: '5250', industry: '情報・通信業',
    price: 2122.0, per: 10.59, pbr: 1.47, roe: 15.18, dividendYield: 3.06, marketCap: 305,
    score: 88, deepScore: 91, trapFlag: 'normal', irbankDate: '2026-07-29',
    equityRatio: 73.5, high52w: 2348.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 1項目が未タグ付けで合計を確定できない（取得できたぶんではD/E 0.08倍）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 16, supply: null, valuation: 14, downside: 15, dividend: 9 },
  },
  {
    rank: 13, code: '3836', name: 'アバントグループ', industryCode: '5250', industry: '情報・通信業',
    price: 1223.0, per: 14.66, pbr: 2.89, roe: 19.76, dividendYield: 5.56, marketCap: 421,
    score: 88, deepScore: 91, trapFlag: 'normal', irbankDate: '2026-08-05',
    equityRatio: 63.9, high52w: 1908.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['有利子負債の水準: 借入金がXBRLにタグ付けされていない', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 15, supply: null, valuation: 11, downside: 13, dividend: 12 },
  },
  {
    rank: 14, code: '3983', name: 'オロ', industryCode: '5250', industry: '情報・通信業',
    price: 1903.0, per: 13.83, pbr: 2.91, roe: 21.58, dividendYield: 2.62, marketCap: 288,
    score: 88, deepScore: 91, trapFlag: 'normal', irbankDate: '2026-08-14',
    equityRatio: 75.3, high52w: 2746.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['特別利益の上乗せ: 会計基準がIFRSで経常利益の概念が無い', '在庫の急増: 前期比を出せる2期ぶんの在庫が無い', '有利子負債の水準: 借入金がXBRLにタグ付けされていない', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 3, supply: null, valuation: 11, downside: 15, dividend: 6 },
  },
  {
    rank: 15, code: '4012', name: 'アクシス', industryCode: '5250', industry: '情報・通信業',
    price: 1732.0, per: 10.29, pbr: 1.75, roe: 18.47, dividendYield: 3.34, marketCap: 74,
    score: 88, deepScore: 91, trapFlag: 'normal', irbankDate: '2026-08-06',
    equityRatio: 75.4, high52w: 1790.0, consecutiveDividendYears: 0, trapReasons: [],
    trapUndetermined: ['在庫の急増: 前期比を出せる2期ぶんの在庫が無い', '有利子負債の水準: 借入金がXBRLにタグ付けされていない', 'のれんの規模: のれんがXBRLにタグ付けされていない（M&Aの有無を判定できない）'],
    dataSource: 'edinet_db',
    scoreBreakdown: { catalyst: null, momentum: 12, supply: null, valuation: 13, downside: 15, dividend: 9 },
  },
];

// EDINET DB / IRBANK から取得した財務詳細データ（上位15社）
// fetchDate: 取得実行日, annual: 有報ベース年次, latest: 直近決算短信
export const edinetDetails: EdinetDetail[] = [
  {
    code: '1787', name: 'ナカボーテック', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2026, annualEquityRatio: 77.0, annualROE: 13.1, annualNetIncome: 11.9, annualOrdinaryIncome: 13.8, annualRevenue: 149.0,
    latestQuarter: 1, latestDisclosureDate: '2026-08-03', latestEquityRatio: 79.1,
    latestNetIncome: -235.0, latestNetIncomeChange: null, forecastNetIncome: 923, forecastNetIncomeChange: -22.2,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YF2C', earningsPdfUrl: null, earningsTitle: '2027年3月期 第1四半期決算短信〔日本基準〕（非連結）',
  },
  {
    code: '3817', name: 'ＳＲＡホールディングス', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2026, annualEquityRatio: 64.7, annualROE: 17.4, annualNetIncome: 56.0, annualOrdinaryIncome: 95.0, annualRevenue: 532.8,
    latestQuarter: 1, latestDisclosureDate: '2026-08-12', latestEquityRatio: null,
    latestNetIncome: 1221.0, latestNetIncomeChange: null, forecastNetIncome: 5500, forecastNetIncomeChange: -1.8,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YHQM', earningsPdfUrl: 'https://www.sra-hd.co.jp/Portals/0/ir/settlement/tanshin/tanshin2608.pdf', earningsTitle: '決算短信',
  },
  {
    code: '3922', name: 'ＰＲ　ＴＩＭＥＳ', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2026, annualEquityRatio: 78.9, annualROE: 30.0, annualNetIncome: 24.0, annualOrdinaryIncome: 36.1, annualRevenue: 95.5,
    latestQuarter: 1, latestDisclosureDate: '2026-07-14', latestEquityRatio: 85.4,
    latestNetIncome: 604.0, latestNetIncomeChange: 5.6, forecastNetIncome: 2200, forecastNetIncomeChange: -8.3,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100Y6DH', earningsPdfUrl: null, earningsTitle: '2027-02',
  },
  {
    code: '9709', name: 'ＮＣＳ＆Ａ', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2026, annualEquityRatio: 64.8, annualROE: 14.7, annualNetIncome: 20.7, annualOrdinaryIncome: 28.7, annualRevenue: 224.9,
    latestQuarter: 1, latestDisclosureDate: '2026-07-30', latestEquityRatio: 62.9,
    latestNetIncome: 478.0, latestNetIncomeChange: 11.5, forecastNetIncome: 1830, forecastNetIncomeChange: -11.5,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YAMN', earningsPdfUrl: 'https://ncsa.jp/application/files/2317/8539/6696/2027-3-1stqtr-kessan-tanshin.pdf', earningsTitle: '２０２７年３月期 第１四半期決算短信 ［２０２６年７月３０日］ (約',
  },
  {
    code: '4783', name: 'ＮＣＤ', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2026, annualEquityRatio: 50.1, annualROE: 22.9, annualNetIncome: 18.6, annualOrdinaryIncome: 26.7, annualRevenue: 308.7,
    latestQuarter: 1, latestDisclosureDate: '2026-08-07', latestEquityRatio: null,
    latestNetIncome: 251.0, latestNetIncomeChange: null, forecastNetIncome: 1830, forecastNetIncomeChange: -1.7,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YEMH', earningsPdfUrl: null, earningsTitle: '2027年3月期 第1四半期決算短信〔日本基準〕(連結)',
  },
  {
    code: '2307', name: 'クロスキャット', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2026, annualEquityRatio: 61.4, annualROE: 24.2, annualNetIncome: 15.1, annualOrdinaryIncome: 20.4, annualRevenue: 173.1,
    latestQuarter: 1, latestDisclosureDate: '2026-08-05', latestEquityRatio: null,
    latestNetIncome: 325.0, latestNetIncomeChange: null, forecastNetIncome: 1540, forecastNetIncomeChange: 1.9,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YJU2', earningsPdfUrl: 'https://www.xcat.co.jp/ja/ir/news/auto_20260805509745/pdfFile.pdf', earningsTitle: '2026年08月05日 2027年３月期第１四半期決算短信〔日本基準〕(連結)',
  },
  {
    code: '3901', name: 'マークラインズ', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2025, annualEquityRatio: 74.2, annualROE: 23.1, annualNetIncome: 15.2, annualOrdinaryIncome: 21.5, annualRevenue: 55.7,
    latestQuarter: 2, latestDisclosureDate: '2026-08-06', latestEquityRatio: 72.8,
    latestNetIncome: 797.0, latestNetIncomeChange: 6.1, forecastNetIncome: 1660, forecastNetIncomeChange: 9.2,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100XSGJ', earningsPdfUrl: null, earningsTitle: '2026年12月期 第２四半期（中間期）決算短信〔日本基準〕(連結)',
  },
  {
    code: '3921', name: 'ネオジャパン', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2026, annualEquityRatio: 69.9, annualROE: 26.3, annualNetIncome: 18.1, annualOrdinaryIncome: 26.1, annualRevenue: 82.3,
    latestQuarter: 2, latestDisclosureDate: '2026-09-11', latestEquityRatio: 71.3,
    latestNetIncome: 947.0, latestNetIncomeChange: 6.6, forecastNetIncome: 1876, forecastNetIncomeChange: 3.7,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100Y0W0', earningsPdfUrl: null, earningsTitle: '2027年１月期第２四半期（中間期）決算短信〔日本基準〕(連結)',
  },
  {
    code: '6915', name: '千代田インテグレ', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2025, annualEquityRatio: 80.1, annualROE: 6.4, annualNetIncome: 26.2, annualOrdinaryIncome: 32.8, annualRevenue: 380.4,
    latestQuarter: 2, latestDisclosureDate: '2026-08-07', latestEquityRatio: null,
    latestNetIncome: 2071.0, latestNetIncomeChange: null, forecastNetIncome: 3500, forecastNetIncomeChange: 33.4,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100XT6S', earningsPdfUrl: 'https://www.chiyoda-i.co.jp/wp-content/uploads/2026/05/20260807.pdf', earningsTitle: '2026年12月期 第2四半期決算短信',
  },
  {
    code: '500A', name: 'ＴＯブックス', dataSource: 'unavailable', fetchDate: '2026-09-18',
  },
  {
    code: '1952', name: '新日本空調', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2026, annualEquityRatio: 61.0, annualROE: 16.0, annualNetIncome: 121.5, annualOrdinaryIncome: 158.8, annualRevenue: 1548.8,
    latestQuarter: 1, latestDisclosureDate: '2026-08-07', latestEquityRatio: null,
    latestNetIncome: 2739.0, latestNetIncomeChange: null, forecastNetIncome: 12800, forecastNetIncomeChange: 5.3,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YDMT', earningsPdfUrl: 'https://pdf.irpocket.com/C1952/xoA3/ieAo/Bawv/aNJb.pdf', earningsTitle: '2027年3月期 第1四半期決算短信 〔日本基準〕（連結） （553KB） [553.7KB] PDF',
  },
  {
    code: '2359', name: 'コア', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2026, annualEquityRatio: 73.5, annualROE: 14.7, annualNetIncome: 28.8, annualOrdinaryIncome: 39.2, annualRevenue: 265.3,
    latestQuarter: 1, latestDisclosureDate: '2026-07-29', latestEquityRatio: 73.9,
    latestNetIncome: 593.0, latestNetIncomeChange: 18.8, forecastNetIncome: 3000, forecastNetIncomeChange: 4.2,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100YE3S', earningsPdfUrl: 'https://www.core.co.jp/system/files/2026-07/ir_20260729-1.pdf', earningsTitle: '2027-03',
  },
  {
    code: '3836', name: 'アバントグループ', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2025, annualEquityRatio: 63.9, annualROE: 23.8, annualNetIncome: 34.3, annualOrdinaryIncome: 46.1, annualRevenue: 282.3,
    latestQuarter: 4, latestDisclosureDate: '2026-08-05', latestEquityRatio: null,
    latestNetIncome: 2985.0, latestNetIncomeChange: null, forecastNetIncome: 3450, forecastNetIncomeChange: 15.6,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100WPOP', earningsPdfUrl: 'https://www.avantgroup.com/ja/ir/irnews/auto_20260805509926/pdfFile.pdf', earningsTitle: '2026年６月期決算短信〔日本基準〕(連結)',
  },
  {
    code: '3983', name: 'オロ', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2025, annualEquityRatio: 75.3, annualROE: 18.4, annualNetIncome: 19.0, annualOrdinaryIncome: null, annualRevenue: 83.1,
    latestQuarter: 2, latestDisclosureDate: '2026-08-14', latestEquityRatio: null,
    latestNetIncome: 1003.0, latestNetIncomeChange: null, forecastNetIncome: 2147, forecastNetIncomeChange: 13.2,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100XR9Z', earningsPdfUrl: 'https://contents.xj-storage.jp/xcontents/AS01398/53910bce/6d75/4be3/8f19/3883cde64efc/140120260812518396.pdf', earningsTitle: '決算短信 | 2026年12月期 第2四半期（中間期）決算短信〔IFRS〕（連結）',
  },
  {
    code: '4012', name: 'アクシス', dataSource: 'edinet_db', fetchDate: '2026-09-18',
    fiscalYear: 2025, annualEquityRatio: 75.4, annualROE: 16.8, annualNetIncome: 6.4, annualOrdinaryIncome: 9.2, annualRevenue: 81.3,
    latestQuarter: 2, latestDisclosureDate: '2026-08-06', latestEquityRatio: null,
    latestNetIncome: 376.0, latestNetIncomeChange: null, forecastNetIncome: 700, forecastNetIncomeChange: 8.9,
    edinetUrl: 'https://disclosure2.edinet-fsa.go.jp/WZEK0040.aspx?S100XS04', earningsPdfUrl: 'https://contents.xj-storage.jp/xcontents/AS04553/ca9f2412/7e7f/4e3d/92d2/41d8cb468f70/140120260803507505.pdf', earningsTitle: '2026年12月期第２四半期（中間期）決算短信〔日本基準〕(非連結)',
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
