import type { Plugin } from 'vite';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Vite dev plugin: /api/fetch-macro エンドポイント
 *
 * 処理フロー:
 *   ① python scripts/fetch_macro.py を実行
 *      → scripts/macro_raw.txt を生成
 *   ② claude -p "<プロンプト>" で macro_raw.txt を分析し、**JSON** を stdout に出力
 *   ③ Node.js 側で JSON をパース → src/data.ts を機械的に書き換え
 *   ④ Vite HMR が data.ts の変更を検知して画面を自動リロード
 *
 * 通信方式: Server-Sent Events (SSE)
 */

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
  src = src.replace(
    /export const macroMeta = \{[\s\S]*?\};/,
    `export const macroMeta = {\n  latestArticleDate: '${esc(analysis.latestArticleDate)}',\n};`
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

// -------------------------------------------------------------
// Vite プラグイン本体
// -------------------------------------------------------------

export function macroPlugin(): Plugin {
  return {
    name: 'macro-fetch-plugin',
    configureServer(server) {
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
        send({ type: 'step', step: 1, message: '① 最新記事を取得中... (python scripts/fetch_macro.py)' });

        // ① Python スクリプトで記事取得
        const py = spawn('python', ['scripts/fetch_macro.py'], {
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
          finish('error', `Python実行エラー: ${err.message}`);
        });

        py.on('close', (code) => {
          if (code !== 0) {
            finish('error', `fetch_macro.py が失敗 (exit=${code})`);
            return;
          }
          send({ type: 'log', message: '✓ macro_raw.txt を生成しました' });
          send({ type: 'step', step: 2, message: '② Claude Code で分析中... (claude -p → JSON)' });

          // ② claude -p で JSON を得る
          const claude = spawn(
            'claude',
            ['-p', CLAUDE_PROMPT, '--permission-mode', 'acceptEdits'],
            {
              cwd,
              shell: true,
              stdio: ['ignore', 'pipe', 'pipe'],
            }
          );

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
    },
  };
}
