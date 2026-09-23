import type { Plugin } from 'vite';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';

/**
 * Vite dev plugin: 2つの開発用エンドポイントを提供する
 *
 *   POST /api/fetch-macro    … マクロ分析を更新（Claude を呼ぶ・API利用料が発生）
 *   POST /api/refresh-prices … 株価だけ更新（Python のみ・課金なし・約12秒）
 *   POST /api/run-screening  … フルスクリーニング（約13分・EDINET最大80回・銘柄が入れ替わる）
 *   GET  /api/screening-status … 上記の有効/無効と前回実行日を返す（副作用なし）
 *                              .env.local に DISABLE_SCREENING_RUN=1 で両方を無効化できる
 *   GET  /api/env            … このサーバが実際に使う Python コマンド名を返す（副作用なし）
 *                              画面に出すコマンド文字列を OS に合わせるためだけに使う
 *
 * /api/fetch-macro の処理フロー:
 *
 * 処理フロー:
 *   ① ${PYTHON_BIN} scripts/fetch_macro.py を実行（既定 python3 / 環境変数 PYTHON で変更可）
 *      → scripts/macro_raw.txt を生成
 *   ② claude -p "<プロンプト>" で macro_raw.txt を分析し、**JSON** を stdout に出力
 *   ③ Node.js 側で JSON をパース → src/data.ts を機械的に書き換え
 *   ④ Vite HMR が data.ts の変更を検知して画面を自動リロード
 *
 * 通信方式: Server-Sent Events (SSE)
 */

// Python 実行コマンド。OSごとに実在するコマンド名が違うため自動判定する。
//   Windows : `python`（python.org のインストーラは python.exe と py.exe だけを作る。
//             `python3.exe` は通常存在せず、Microsoft Store のアプリ実行エイリアスが
//             反応してストアが開くという紛らわしい挙動になる）
//   macOS/Linux : `python3`（macOS 12.3 以降は `python` が存在しない）
// 環境変数 PYTHON があればそれを最優先する（venv や py ランチャー用）。
const IS_WINDOWS = process.platform === 'win32';
const PYTHON_BIN = process.env.PYTHON ?? (IS_WINDOWS ? 'python' : 'python3');

/** コマンドが見つからなかったときの終了コードは OS で違う。
 *  Unix系シェル = 127 / Windows の cmd.exe = 9009。
 *  片方だけ見ていると、もう片方で「原因不明の失敗」になる。 */
function isCommandNotFound(code: number | null): boolean {
  return code === 127 || code === 9009;
}

/** Python が見つからないときの案内文（両OSで意味が通るようにする） */
function pythonNotFoundHint(): string {
  return `：'${PYTHON_BIN}' コマンドが見つかりません。`
    + `環境変数 PYTHON で指定してください`
    + `（${IS_WINDOWS ? '例: set PYTHON=py && npm run dev' : '例: PYTHON=python3.12 npm run dev'}）`;
}

// Claude に JSON のみを出力させるプロンプト
const CLAUDE_PROMPT = `あなたはデータ変換スクリプトです。対話は禁止。以下を厳守してください。

【タスク】
scripts/macro_raw.txt を Read ツールで読み込み、その内容**のみ**を根拠に
下記スキーマの JSON を出力してください。

【出力スキーマ】
\`\`\`json
{
  "weather": "晴れ" | "曇り" | "嵐",
  "weatherDetail": "相場環境を1行で要約（40文字程度）",
  "latestArticleDate": "YYYY-MM-DD",
  "economistReports": [
    {
      "name": "藤代 宏一",
      "org": "第一生命経済研究所",
      "role": "チーフエコノミスト",
      "url": "https://www.dlri.co.jp/members/fujishiro.html",
      "date": "YYYY-MM-DD",
      "topics": ["論点1（1文）", "論点2", "論点3", "論点4"]
    },
    {
      "name": "木内 登英",
      "org": "NRI",
      "role": "エグゼクティブ・エコノミスト",
      "url": "https://www.nri.com/jp/media/column/kiuchi/index.html",
      "date": "YYYY-MM-DD",
      "topics": ["...", "...", "...", "..."]
    },
    {
      "name": "武者 陵司",
      "org": "武者リサーチ",
      "role": "代表",
      "url": "https://www.musha.co.jp/",
      "date": "YYYY-MM-DD",
      "topics": ["...", "...", "...", "..."]
    }
  ],
  "targetSectors": [
    { "code": "5250", "name": "情報・通信業", "reason": "なぜ狙うかを記事の論点に基づき1文で" }
  ],
  "avoidSectors": [
    { "name": "海運業", "reason": "なぜ避けるかを記事の論点に基づき1文で" }
  ]
}
\`\`\`

【業種コード表（JPX 33業種・targetSectors[i].code は必ずこの中から選ぶ）】
0050 水産・農林業 / 1050 鉱業 / 2050 建設業 / 3050 食料品 / 3100 繊維製品 /
3150 パルプ・紙 / 3200 化学 / 3250 医薬品 / 3300 石油・石炭製品 / 3350 ゴム製品 /
3400 ガラス・土石製品 / 3450 鉄鋼 / 3500 非鉄金属 / 3550 金属製品 / 3600 機械 /
3650 電気機器 / 3700 輸送用機器 / 3750 精密機器 / 3800 その他製品 / 4050 電気・ガス業 /
5050 陸運業 / 5100 海運業 / 5150 空運業 / 5200 倉庫・運輸関連業 / 5250 情報・通信業 /
6050 卸売業 / 6100 小売業 / 7050 銀行業 / 7100 証券・商品先物 / 7150 保険業 /
7200 その他金融業 / 8050 不動産業 / 9050 サービス業

【ルール】
- 各 economistReports[i].date はそのエコノミストの最新記事の日付
- topics は記事本文から読み取れる主要な論点を4つ、各1文で簡潔に（憶測禁止）
- weather は記事全体のトーンから総合判断（ポジ=晴れ、中立=曇り、ネガ=嵐）
- weatherDetail は相場環境を1行で要約
- latestArticleDate は全記事の中で最も新しい日付
- **targetSectors**: 記事全体の論点から「半年運用で狙うべき業種」を3〜5個選ぶ。
  code は上記コード表から厳密に選び、reason は記事の根拠に基づく1文（憶測禁止）。
- **avoidSectors**: 同様に「避けるべき業種」を2〜4個。reason は1文。
- targetSectors / avoidSectors はマクロ環境の最新論点を必ず反映させること
  （前回の固定値をそのまま流用しない）。

【出力形式】
- **JSON のみ** を出力（\`\`\`json ... \`\`\` のコードブロックで囲む）
- JSON 以外の前置き・後書き・説明文は**一切不要**
- ファイル編集（Edit/Write ツール）は**使わない**。stdout に JSON を出力するだけ`;

// -------------------------------------------------------------
// data.ts を書き換えるユーティリティ
// -------------------------------------------------------------

type EconomistInput = {
  name: string;
  org: string;
  role: string;
  url: string;
  date: string;
  topics: string[];
};

type TargetSectorInput = { code: string; name: string; reason: string };
type AvoidSectorInput = { name: string; reason: string };

type MacroAnalysis = {
  weather: '晴れ' | '曇り' | '嵐';
  weatherDetail: string;
  latestArticleDate: string;
  economistReports: EconomistInput[];
  targetSectors: TargetSectorInput[];
  avoidSectors: AvoidSectorInput[];
};

/** TS文字列リテラル用のエスケープ（シングルクォート） */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** economistReports 配列の TS コードを生成 */
function renderEconomistReports(list: EconomistInput[]): string {
  const items = list
    .map((r) => {
      const topics = r.topics.map((t) => `      '${esc(t)}',`).join('\n');
      return `  {
    name: '${esc(r.name)}',
    org: '${esc(r.org)}',
    role: '${esc(r.role)}',
    url: '${esc(r.url)}',
    topics: [
${topics}
    ],
    date: '${esc(r.date)}',
  }`;
    })
    .join(',\n');
  return `export const economistReports: EconomistReport[] = [\n${items},\n];`;
}

/** targetSectors 配列の TS コードを生成 */
function renderTargetSectors(list: TargetSectorInput[]): string {
  const items = list
    .map(
      (s) =>
        `  { code: '${esc(s.code)}', name: '${esc(s.name)}', reason: '${esc(s.reason)}' },`
    )
    .join('\n');
  return `export const targetSectors: TargetSector[] = [\n${items}\n];`;
}

/** avoidSectors 配列の TS コードを生成 */
function renderAvoidSectors(list: AvoidSectorInput[]): string {
  const items = list
    .map((s) => `  { name: '${esc(s.name)}', reason: '${esc(s.reason)}' },`)
    .join('\n');
  return `export const avoidSectors: AvoidSector[] = [\n${items}\n];`;
}

/** Claude の stdout から JSON を抽出 */
function extractJson(stdout: string): MacroAnalysis {
  // ```json ... ``` コードブロック優先
  const fenced = stdout.match(/```(?:json)?\s*([\s\S]*?)```/);
  let jsonText = fenced ? fenced[1] : '';

  // なければ最初の { から最後の } までを抽出
  if (!jsonText) {
    const first = stdout.indexOf('{');
    const last = stdout.lastIndexOf('}');
    if (first >= 0 && last > first) {
      jsonText = stdout.slice(first, last + 1);
    }
  }
  if (!jsonText) throw new Error('Claude の出力から JSON を抽出できませんでした');

  const parsed = JSON.parse(jsonText.trim()) as MacroAnalysis;

  // 最低限のバリデーション
  if (!parsed.weather || !['晴れ', '曇り', '嵐'].includes(parsed.weather)) {
    throw new Error(`weather が不正: ${parsed.weather}`);
  }
  if (!parsed.weatherDetail) throw new Error('weatherDetail がありません');
  if (!parsed.latestArticleDate) throw new Error('latestArticleDate がありません');
  if (!Array.isArray(parsed.economistReports) || parsed.economistReports.length === 0) {
    throw new Error('economistReports が空です');
  }
  for (const r of parsed.economistReports) {
    if (!r.name || !r.date || !Array.isArray(r.topics) || r.topics.length === 0) {
      throw new Error(`economistReports の要素が不正: ${JSON.stringify(r)}`);
    }
  }
  if (!Array.isArray(parsed.targetSectors) || parsed.targetSectors.length === 0) {
    throw new Error('targetSectors が空です（業種の絞り込みに失敗）');
  }
  for (const s of parsed.targetSectors) {
    if (!s.code || !/^\d{4}$/.test(s.code) || !s.name || !s.reason) {
      throw new Error(`targetSectors の要素が不正（codeは4桁数字）: ${JSON.stringify(s)}`);
    }
  }
  if (!Array.isArray(parsed.avoidSectors)) {
    throw new Error('avoidSectors が配列ではありません');
  }
  for (const s of parsed.avoidSectors) {
    if (!s.name || !s.reason) {
      throw new Error(`avoidSectors の要素が不正: ${JSON.stringify(s)}`);
    }
  }
  return parsed;
}

/** data.ts を書き換える */
function patchDataTs(dataTsPath: string, analysis: MacroAnalysis): void {
  let src = readFileSync(dataTsPath, 'utf8');

  // 1. weather を置換
  src = src.replace(
    /export const weather = '(?:晴れ|曇り|嵐)' as const;/,
    `export const weather = '${analysis.weather}' as const;`
  );

  // 2. weatherDetail を置換
  src = src.replace(
    /export const weatherDetail = '[^']*';/,
    `export const weatherDetail = '${esc(analysis.weatherDetail)}';`
  );

  // 3. macroMeta を置換（複数行の object literal）
  //   generatedDate は「この分析をいつ走らせたか」。記事日付（latestArticleDate）とは別物で、
  //   記事が新しくても分析自体が1か月前ということがあるため両方持つ。
  //   Claude の出力ではなくここで採る（分析の実行時刻を知っているのはこちら側だけ）。
  const generatedDate = new Date().toLocaleDateString('sv-SE');   // ローカル日付の YYYY-MM-DD
  src = src.replace(
    /export const macroMeta = \{[\s\S]*?\};/,
    `export const macroMeta = {\n  latestArticleDate: '${esc(analysis.latestArticleDate)}',\n  generatedDate: '${generatedDate}',\n};`
  );

  // 4. economistReports[] を置換
  //   non-greedy で最初の "];" まで
  const rendered = renderEconomistReports(analysis.economistReports);
  const beforeLen = src.length;
  src = src.replace(
    /export const economistReports: EconomistReport\[\] = \[[\s\S]*?\n\];/,
    rendered
  );
  if (src.length === beforeLen) {
    throw new Error('economistReports の置換に失敗（パターン不一致）');
  }

  // 5. targetSectors[] を置換（最新マクロから絞り込んだ業種）
  const beforeTarget = src.length;
  src = src.replace(
    /export const targetSectors: TargetSector\[\] = \[[\s\S]*?\n\];/,
    renderTargetSectors(analysis.targetSectors)
  );
  if (src.length === beforeTarget && !src.includes(renderTargetSectors(analysis.targetSectors))) {
    throw new Error('targetSectors の置換に失敗（パターン不一致）');
  }

  // 6. avoidSectors[] を置換
  src = src.replace(
    /export const avoidSectors: AvoidSector\[\] = \[[\s\S]*?\n\];/,
    renderAvoidSectors(analysis.avoidSectors)
  );

  writeFileSync(dataTsPath, src, 'utf8');
}

// ═══════════════════════════════════════════════════════════════
// BEGIN: フルスクリーニング実行の補助（削除時はこのブロックも消す）
// ═══════════════════════════════════════════════════════════════

// 実行中フラグ。二重起動を防ぐ。
// 複数タブから同時に押されても1本しか走らせない（EDINET枠の無駄撃ちを防ぐ）。
let screeningInFlight = false;

/** .env.local に DISABLE_SCREENING_RUN=1 があれば実行を止める。
 *  コードを触らずボタンを引っ込めるための緊急スイッチ。
 *  毎回読み直すので、書き足した時点で即反映される（dev server の再起動不要）。 */
function isScreeningRunDisabled(): boolean {
  if (process.env.DISABLE_SCREENING_RUN === '1') return true;
  try {
    const env = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
    return /^\s*DISABLE_SCREENING_RUN\s*=\s*1\s*$/m.test(env);
  } catch {
    return false;   // .env.local が無い場合は有効のまま
  }
}

/** 前回スクリーニングを実行した日（YYYY-MM-DD）。読めなければ null。 */
function readLastScreeningDate(): string | null {
  try {
    const meta = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'scripts/screening_meta.json'), 'utf8'),
    );
    return typeof meta.runDate === 'string' ? meta.runDate : null;
  } catch {
    return null;
  }
}

/** 上書き前に現状を退避する。戻せない更新をしないため、失敗したら実行自体を中止する。 */
function backupBeforeScreening(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.resolve(process.cwd(), 'scripts/backup', stamp);
  mkdirSync(dir, { recursive: true });
  for (const rel of ['src/data.ts', 'scripts/screening_result.json', 'scripts/screening_meta.json']) {
    const from = path.resolve(process.cwd(), rel);
    if (existsSync(from)) {
      copyFileSync(from, path.join(dir, path.basename(rel)));
    }
  }
  return path.relative(process.cwd(), dir);
}

// ═══════════════════════════════════════════════════════════════
// END: フルスクリーニング実行の補助
// ═══════════════════════════════════════════════════════════════

// -------------------------------------------------------------
// Vite プラグイン本体
// -------------------------------------------------------------

export function macroPlugin(): Plugin {
  return {
    name: 'macro-fetch-plugin',
    configureServer(server) {
      // ═══════════════════════════════════════════════════════════════
      // GET /api/env … 実行環境の申告（副作用なし・課金なし）
      //
      // なぜ必要か:
      //   画面には「このコマンドを実行してください」という案内を出しているが、
      //   Python の実行コマンド名は OS で違う（Windows: python / macOS: python3）。
      //   data.ts は Mac で生成したものを Windows のメンバーも使うため、
      //   コマンド名を data.ts に焼き込むと受け取った側で必ず嘘になる。
      //   鮮度タグを凍結してはいけないのと同じ理由で、表示のたびにサーバへ問い合わせる。
      //
      // ブラウザ自身は自分が載っている PC の OS を知っていても、
      // Python がどの名前で入っているか（PYTHON=py などの上書きを含む）は知らない。
      // 実際に spawn する側が答えるのが唯一の正解。
      //
      // 返すのはコマンド名だけ。環境変数そのものは返さない（.env.local に APIキーがある）。
      server.middlewares.use('/api/env', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({
          pythonBin: PYTHON_BIN,
          isWindows: IS_WINDOWS,
          // PYTHON で明示的に上書きされているか。画面の注記を出し分けるために使う。
          pythonFromEnv: process.env.PYTHON != null,
        }));
      });

      server.middlewares.use('/api/fetch-macro', (req, res) => {
        if (req.method !== 'POST' && req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        // SSE ヘッダー
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const send = (data: Record<string, unknown>) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const cwd = process.cwd();
        const dataTsPath = path.resolve(cwd, 'src/data.ts');
        let finished = false;

        const finish = (type: 'done' | 'error', message?: string) => {
          if (finished) return;
          finished = true;
          send({ type, message });
          res.end();
        };

        send({ type: 'log', message: '=== マクロ分析開始 ===' });
        send({ type: 'step', step: 1, message: `① 最新記事を取得中... (${PYTHON_BIN} scripts/fetch_macro.py)` });

        // ① Python スクリプトで記事取得
        const py = spawn(PYTHON_BIN, ['scripts/fetch_macro.py'], {
          cwd,
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        py.stdout.on('data', (chunk) => {
          const text = chunk.toString('utf8');
          text.split(/\r?\n/).forEach((line: string) => {
            if (line.trim()) send({ type: 'log', message: line });
          });
        });
        py.stderr.on('data', (chunk) => {
          const text = chunk.toString('utf8');
          text.split(/\r?\n/).forEach((line: string) => {
            if (line.trim()) send({ type: 'log', message: `[py-err] ${line}` });
          });
        });
        py.on('error', (err) => {
          finish('error', `Python実行エラー（${PYTHON_BIN}）: ${err.message}`
            + ((err as NodeJS.ErrnoException).code === 'ENOENT' ? pythonNotFoundHint() : ''));
        });

        py.on('close', (code) => {
          if (code !== 0) {
            // Python のコマンド名が環境と合っていない場合の案内（終了コードは OS で違う）
            const hint = isCommandNotFound(code) ? pythonNotFoundHint() : '';
            finish('error', `fetch_macro.py が失敗 (exit=${code})${hint}`);
            return;
          }
          send({ type: 'log', message: '✓ macro_raw.txt を生成しました' });
          send({ type: 'step', step: 2, message: '② Claude Code で分析中... (claude -p → JSON)' });

          // ② claude -p で JSON を得る
          // プロンプトは **argv ではなく stdin** で渡す。
          // CLAUDE_PROMPT には改行・引用符・バッククォート（```json のコードフェンス）が
          // 含まれるため、argv に載せると shell: true 実行時にシェルへ素通しされ、
          // バッククォートがコマンド置換として解釈されてプロンプトが破壊される
          // （macOS/Linux で発生。Windows の cmd.exe では顕在化しなかった）。
          // stdin 経由なら shell を経由しないので、どの OS でも内容がそのまま届く。
          const claude = spawn(
            'claude',
            ['-p', '--permission-mode', 'acceptEdits'],
            {
              cwd,
              shell: true,
              stdio: ['pipe', 'pipe', 'pipe'],
            }
          );

          // プロンプトを stdin に流し込んで閉じる（EOF を送らないと claude が待ち続ける）
          claude.stdin.on('error', () => { /* 相手が先に終了した場合は無視 */ });
          claude.stdin.write(CLAUDE_PROMPT);
          claude.stdin.end();

          let claudeStdout = '';
          claude.stdout.on('data', (chunk) => {
            const text = chunk.toString('utf8');
            claudeStdout += text;
            text.split(/\r?\n/).forEach((line: string) => {
              if (line.trim()) send({ type: 'log', message: line });
            });
          });
          claude.stderr.on('data', (chunk) => {
            const text = chunk.toString('utf8');
            text.split(/\r?\n/).forEach((line: string) => {
              if (line.trim()) send({ type: 'log', message: `[claude-err] ${line}` });
            });
          });
          claude.on('error', (err) => {
            finish('error', `claude コマンド実行エラー: ${err.message}`);
          });

          claude.on('close', (ccode) => {
            if (ccode !== 0) {
              finish('error', `claude -p が失敗 (exit=${ccode})`);
              return;
            }

            // ③ JSON をパース → data.ts を書き換え
            send({ type: 'log', message: '━━━ JSON パース & data.ts 書き換え ━━━' });
            try {
              const analysis = extractJson(claudeStdout);
              send({
                type: 'log',
                message: `✓ JSON パース成功: weather=${analysis.weather}, 最新日=${analysis.latestArticleDate}, エコノミスト${analysis.economistReports.length}件`,
              });

              patchDataTs(dataTsPath, analysis);
              send({ type: 'log', message: '✓ src/data.ts を書き換えました' });
              send({ type: 'step', step: 3, message: '③ 画面を自動更新します...' });
              finish('done', 'マクロ分析が完了しました');
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              finish('error', `data.ts 更新に失敗: ${msg}`);
            }
          });
        });

        // クライアント切断時の後始末
        req.on('close', () => {
          if (!finished) {
            try { py.kill(); } catch {}
          }
        });
      });

      // ── 株価だけを更新する（Claude を呼ばないので課金は発生しない） ──
      server.middlewares.use('/api/refresh-prices', (req, res) => {
        if (req.method !== 'POST' && req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const send = (data: Record<string, unknown>) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        let finished = false;
        const finish = (type: 'done' | 'error', message?: string) => {
          if (finished) return;
          finished = true;
          send({ type, message });
          res.end();
        };

        send({ type: 'log', message: `株価を取得中... (${PYTHON_BIN} scripts/refresh_prices.py)` });

        const py = spawn(PYTHON_BIN, ['scripts/refresh_prices.py'], {
          cwd: process.cwd(),
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        py.stdout.on('data', (chunk) => {
          chunk.toString('utf8').split(/\r?\n/).forEach((line: string) => {
            if (line.trim()) send({ type: 'log', message: line });
          });
        });
        py.stderr.on('data', (chunk) => {
          chunk.toString('utf8').split(/\r?\n/).forEach((line: string) => {
            if (line.trim()) send({ type: 'log', message: `[py-err] ${line}` });
          });
        });
        py.on('error', (err) => {
          finish('error', `Python実行エラー（${PYTHON_BIN}）: ${err.message}`
            + ((err as NodeJS.ErrnoException).code === 'ENOENT' ? pythonNotFoundHint() : ''));
        });
        py.on('close', (code) => {
          if (code !== 0) {
            const hint = isCommandNotFound(code) ? pythonNotFoundHint() : '';
            finish('error', `refresh_prices.py が失敗 (exit=${code})${hint}`);
            return;
          }
          finish('done', '株価を更新しました');
        });

        req.on('close', () => {
          if (!finished) {
            try { py.kill(); } catch {}
          }
        });
      });

      // ═══════════════════════════════════════════════════════════════
      // BEGIN: フルスクリーニング実行エンドポイント
      //
      // 【削除方法】不要になったら次の3点を消すだけで元に戻る:
      //   1. この BEGIN〜END ブロック
      //   2. src/ScreeningRunButton.tsx（ファイルごと削除）
      //   3. src/ScreeningView.tsx の import と <ScreeningRunButton /> の2行
      // 【一時的に止める方法】.env.local に DISABLE_SCREENING_RUN=1 を書く
      //   → ボタンが消え、エンドポイントも 403 を返す（コード変更・再起動不要）
      //
      // 株価更新（約12秒・API0回）と違い、この処理は約13分かかり
      // EDINET DB を最大80回消費する（無料枠100回/日）。誤操作の代償が大きいため
      // 次の多重防御を入れている:
      //   ・二重起動の禁止（サーバ側で単一実行ロック）
      //   ・同日2回目は force=1 が無いと拒否（API枠の保護）
      //   ・実行前に data.ts / screening_result.json / screening_meta.json をバックアップ
      //   ・業種コードは厳格に検証し、shell を経由せず spawn する（コマンド注入の防止）
      // ═══════════════════════════════════════════════════════════════
      // 状態問い合わせ（軽量・副作用なし）。
      // 無効化フラグと前回実行日をクライアントに渡すためのもの。
      // .env.local の1箇所で切れるよう、クライアント側に別のフラグは置かない。
      server.middlewares.use('/api/screening-status', (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({
          enabled: !isScreeningRunDisabled(),
          lastRunDate: readLastScreeningDate(),
          inFlight: screeningInFlight,
          today: new Date().toLocaleDateString('sv-SE'),
        }));
      });

      server.middlewares.use('/api/run-screening', (req, res) => {
        // POST のみ。GET を許すと、ブラウザのプリフェッチやURL直打ちで
        // 13分・EDINET80回の処理が走ってしまう。
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed（POST のみ）');
          return;
        }

        if (isScreeningRunDisabled()) {
          res.statusCode = 403;
          res.end('フルスクリーニングの実行は .env.local の DISABLE_SCREENING_RUN=1 で無効化されています');
          return;
        }

        const url = new URL(req.url ?? '/', 'http://localhost');
        const rawIndustries = (url.searchParams.get('industries') ?? '').trim();
        const preset = (url.searchParams.get('preset') ?? '').trim();
        const top = (url.searchParams.get('top') ?? '15').trim();
        const force = url.searchParams.get('force') === '1';

        // ── 入力検証 ──
        // shell を使わない spawn でも、想定外の値でスクリプトを走らせない。
        if (!/^\d{4}(,\d{4})*$/.test(rawIndustries)) {
          res.statusCode = 400;
          res.end('industries は4桁の業種コードをカンマ区切りで指定してください');
          return;
        }
        if (!/^[a-z_]{1,32}$/.test(preset)) {
          res.statusCode = 400;
          res.end('preset の形式が不正です');
          return;
        }
        if (!/^\d{1,2}$/.test(top) || Number(top) < 1 || Number(top) > 50) {
          res.statusCode = 400;
          res.end('top は1〜50で指定してください');
          return;
        }

        if (screeningInFlight) {
          res.statusCode = 409;
          res.end('すでにスクリーニングが実行中です');
          return;
        }

        // ── 同日2回目の拒否（EDINET無料枠の保護）──
        const lastRunDate = readLastScreeningDate();
        const today = new Date().toLocaleDateString('sv-SE');
        if (!force && lastRunDate === today) {
          res.statusCode = 429;
          res.end(`本日（${today}）はすでにスクリーニングを実行済みです。EDINETの無料枠は100回/日で、`
            + '1回の実行で最大80回消費します。それでも実行する場合は force=1 を指定してください');
          return;
        }

        screeningInFlight = true;

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        const send = (data: Record<string, unknown>) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        let finished = false;
        let aborted = false;
        const finish = (type: 'done' | 'error', message?: string) => {
          if (finished) return;
          finished = true;
          screeningInFlight = false;
          send({ type, message });
          res.end();
        };

        // ── 実行前バックアップ ──
        // 既存の15社を上書きするため、戻せる状態を作ってから走らせる。
        let backupDir: string | null = null;
        try {
          backupDir = backupBeforeScreening();
          send({ type: 'log', message: `バックアップ: ${backupDir}` });
        } catch (e) {
          finish('error', `バックアップに失敗したため中止しました: ${(e as Error).message}`);
          return;
        }

        const args = [
          'scripts/fetch_stocks.py',
          '--industries', rawIndustries,
          '--preset', preset,
          '--top', top,
        ];
        send({ type: 'log', message: `実行: ${PYTHON_BIN} ${args.join(' ')}` });
        send({ type: 'log', message: '所要 約10〜13分。この画面を閉じても実行は続きます。' });

        // 業種コードを外部から受け取るため、原則シェルを経由しない（コマンド注入の防止）。
        // ただし Windows では Node 18.20.2 以降のセキュリティ強化により
        // shell: false で .bat / .cmd を起動できず、conda や一部の venv ラッパーが動かない。
        // 引数は上で厳格に検証済み（数字・カンマ・小文字英字のみ）なので、
        // Windows に限り shell: true を許す。
        const py = spawn(PYTHON_BIN, args, {
          cwd: process.cwd(),
          shell: IS_WINDOWS,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        py.stdout.on('data', (chunk) => {
          chunk.toString('utf8').split(/\r?\n/).forEach((line: string) => {
            if (line.trim()) send({ type: 'log', message: line });
          });
        });
        py.stderr.on('data', (chunk) => {
          chunk.toString('utf8').split(/\r?\n/).forEach((line: string) => {
            if (line.trim()) send({ type: 'log', message: `[py-err] ${line}` });
          });
        });
        py.on('error', (err) => {
          finish('error', `Python実行エラー（${PYTHON_BIN}）: ${err.message}`
            + ((err as NodeJS.ErrnoException).code === 'ENOENT' ? pythonNotFoundHint() : ''));
        });

        py.on('close', (code) => {
          if (aborted) {
            finish('error', `中止しました。data.ts は変更されていません（バックアップ: ${backupDir}）`);
            return;
          }
          if (code !== 0) {
            const hint = isCommandNotFound(code) ? pythonNotFoundHint() : '';
            finish('error', `fetch_stocks.py が失敗 (exit=${code})${hint}。`
              + `data.ts は変更されていません（バックアップ: ${backupDir}）`);
            return;
          }

          // スクリーニング成功後に data.ts へ反映する。
          // fetch_stocks.py は JSON を書くだけなので、ここを通らないと画面は変わらない。
          send({ type: 'log', message: '--- ダッシュボードへ反映 ---' });
          const up = spawn(PYTHON_BIN, ['scripts/update_data.py'], {
            cwd: process.cwd(),
            shell: IS_WINDOWS,   // 上と同じ理由（Windows の .bat ラッパー対応）
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          up.stdout.on('data', (chunk) => {
            chunk.toString('utf8').split(/\r?\n/).forEach((line: string) => {
              if (line.trim()) send({ type: 'log', message: line });
            });
          });
          up.stderr.on('data', (chunk) => {
            chunk.toString('utf8').split(/\r?\n/).forEach((line: string) => {
              if (line.trim()) send({ type: 'log', message: `[py-err] ${line}` });
            });
          });
          up.on('error', (err) => finish('error', `update_data.py の起動に失敗: ${err.message}`));
          up.on('close', (c2) => {
            if (c2 !== 0) {
              finish('error', `update_data.py が失敗 (exit=${c2})。`
                + `screening_result.json は更新済みなので ${PYTHON_BIN} scripts/update_data.py を手で実行してください`);
              return;
            }
            finish('done', 'スクリーニングを完了し、ダッシュボードに反映しました');
          });
        });

        // 中止ボタン（クライアント切断）で Python を止める。
        // fetch_stocks.py は最後にまとめて書き出すため、途中で止めても
        // data.ts / screening_result.json は壊れない。
        req.on('close', () => {
          if (!finished) {
            aborted = true;
            // Windows で shell: true のときは cmd.exe が親になるため、
            // SIGTERM だけだと子の python が残る。taskkill でプロセスツリーごと止める。
            try {
              if (IS_WINDOWS && py.pid) {
                spawn('taskkill', ['/pid', String(py.pid), '/T', '/F'], { shell: false });
              } else {
                py.kill('SIGTERM');
              }
            } catch {}
            screeningInFlight = false;
          }
        });
      });
      // ═══════════════════════════════════════════════════════════════
      // END: フルスクリーニング実行エンドポイント
      // ═══════════════════════════════════════════════════════════════
    },
  };
}
