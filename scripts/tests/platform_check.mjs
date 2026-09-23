/**
 * OS 依存箇所の実機チェック（Windows / macOS / Linux で同じものを走らせる）
 *
 * 使い方: node scripts/tests/platform_check.mjs
 *
 * なぜ必要か:
 *   このプロジェクトは Windows と macOS の両方で動かす必要があるが、
 *   開発者は片方の OS しか手元に持っていない。
 *   「静的解析では大丈夫そう」で済ませると BUG-018 のように
 *   もう片方が丸ごと動かない状態を見逃す。
 *   GitHub Actions の windows-latest / macos-latest で同じこのスクリプトを走らせ、
 *   両方で緑になることを確認する。
 *
 * 前提: EDINET の APIキーは不要。ネットワークにも出ない。
 *   Python を「見つからない名前」に差し替えて失敗時の分岐だけを踏ませる。
 */
import { spawn } from 'node:child_process';
import { readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const IS_WINDOWS = process.platform === 'win32';
const EXPECTED_PYTHON = IS_WINDOWS ? 'python' : 'python3';
/** 実在しないコマンド名。失敗時の案内文の分岐を踏ませるために使う */
const MISSING_PYTHON = 'python_does_not_exist_9009';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  … ${detail}` : ''}`);
  if (!ok) failures++;
}

/** dev server を起動し、応答するまで待つ */
async function startDev(port, extraEnv = {}) {
  // vite の起動に npx を使わない。Windows の npx は `npx.cmd` で、
  // Node 18.20.2 以降は shell:false の spawn から .cmd を起動できない（BUG-018 #4）。
  // node で bin の JS を直接叩けば OS 差が出ない。
  // --host 127.0.0.1 を明示するのは、既定の localhost が環境によって ::1(IPv6) に
  // 解決され、fetch の 127.0.0.1 と噛み合わないことがあるため（macOS で実際に起きた）。
  const child = spawn(
    process.execPath,
    [path.resolve('node_modules/vite/bin/vite.js'),
     '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { env: { ...process.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/env`);
      if (r.ok) return child;
    } catch { /* まだ起動中 */ }
  }
  throw new Error(`dev server が起動しませんでした (port ${port})\n${log}`);
}

/** Windows は SIGTERM では子プロセスが残るため taskkill でツリーごと落とす */
function stopDev(child) {
  if (!child?.pid) return;
  if (IS_WINDOWS) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false });
  else child.kill('SIGTERM');
}

/** SSE を最後まで読み、受け取ったイベントの配列を返す */
async function readSse(url, timeoutMs = 60000) {
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) return { status: res.status, body: await res.text(), events: [] };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  const events = [];
  let buf = '';
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    for (const chunk of buf.split('\n\n')) {
      const m = chunk.match(/^data: (.*)$/m);
      if (m) { try { events.push(JSON.parse(m[1])); } catch { /* 分割途中 */ } }
    }
    buf = buf.slice(buf.lastIndexOf('\n\n') + 2);
    if (events.some((e) => e.type === 'done' || e.type === 'error')) break;
  }
  return { status: res.status, events };
}

/** 失敗したときだけ、サーバから届いたログを全部出す。
 *  終了コードや stderr の文言は OS で違うため、実機のログが無いと原因を特定できない。 */
function dumpEvents(label, events) {
  console.log(`   --- ${label} が返したイベント全件 ---`);
  for (const e of events) console.log(`   [${e.type}] ${e.message ?? ''}`);
  console.log('   --- ここまで ---');
}

function backupDirs() {
  const dir = path.resolve('scripts/backup');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => statSync(path.join(dir, n)).isDirectory());
}

// ══════════════════════════════════════════════════
console.log(`\n=== 実行環境: ${process.platform} / node ${process.versions.node} ===\n`);

let dev;
try {
  // ── ① 正常系: /api/env がこの OS の実値を返すか ──────────────
  dev = await startDev(5211);
  const env = await (await fetch('http://127.0.0.1:5211/api/env')).json();
  check('/api/env が この OS の Python コマンド名を返す',
    env.pythonBin === EXPECTED_PYTHON, `期待=${EXPECTED_PYTHON} 実際=${env.pythonBin}`);
  check('/api/env の isWindows が process.platform と一致',
    env.isWindows === IS_WINDOWS, `isWindows=${env.isWindows}`);
  check('/api/env が環境変数そのものを返していない',
    !JSON.stringify(env).match(/API_KEY/i), JSON.stringify(env));

  // ── ② コマンド注入が拒否されるか（両OSで同じ検証を通す）──────
  const injections = [
    'industries=3650;rm%20-rf%20/&preset=stable_defensive&top=15',
    'industries=3650,;whoami&preset=stable_defensive&top=15',
    'industries=3650&preset=bad;ls&top=15',
    'industries=3650&preset=stable_defensive&top=999',
  ];
  for (const q of injections) {
    const r = await fetch(`http://127.0.0.1:5211/api/run-screening?${q}`, { method: 'POST' });
    check(`不正な入力を 400 で拒否 (${decodeURIComponent(q).slice(0, 34)}…)`, r.status === 400, `status=${r.status}`);
  }
  const g = await fetch('http://127.0.0.1:5211/api/run-screening?industries=3650&preset=stable_defensive&top=15');
  check('GET でのスクリーニング実行を 405 で拒否', g.status === 405, `status=${g.status}`);

  stopDev(dev); dev = null;
  await new Promise((r) => setTimeout(r, 2000));

  // ── ③ Python が見つからないときの分岐 ──────────────────────
  //   終了コードは OS で違う（Unix系=127 / cmd.exe=9009 / spawn直呼び=ENOENT）。
  //   案内文が出ることを両OSで確かめる。
  const before = backupDirs();
  dev = await startDev(5212, { PYTHON: MISSING_PYTHON });

  const envBad = await (await fetch('http://127.0.0.1:5212/api/env')).json();
  check('PYTHON 環境変数での上書きが /api/env に反映される',
    envBad.pythonBin === MISSING_PYTHON && envBad.pythonFromEnv === true,
    JSON.stringify(envBad));

  // 株価更新（shell: true 経路 → Windows では cmd.exe の 9009）
  const price = await readSse('http://127.0.0.1:5212/api/refresh-prices');
  const priceErr = price.events.find((e) => e.type === 'error');
  const priceOk = !!priceErr && /コマンドが見つかりません/.test(priceErr.message ?? '');
  check('株価更新: Python 未検出が案内文付きで報告される', priceOk,
    priceErr ? priceErr.message : JSON.stringify(price.events.slice(-2)));
  if (!priceOk) dumpEvents('refresh-prices', price.events);

  // スクリーニング（Windows は shell: true / それ以外は shell: false → ENOENT 経路）
  const scr = await readSse(
    'http://127.0.0.1:5212/api/run-screening?industries=3650&preset=stable_defensive&top=15&force=1');
  const scrErr = scr.events.find((e) => e.type === 'error');
  const scrOk = !!scrErr && /コマンドが見つかりません/.test(scrErr.message ?? '');
  check('スクリーニング: Python 未検出が案内文付きで報告される', scrOk,
    scrErr ? scrErr.message : JSON.stringify(scr.events.slice(-2)));
  if (!scrOk) dumpEvents('run-screening', scr.events);

  stopDev(dev); dev = null;
  await new Promise((r) => setTimeout(r, 2000));

  // ── ④ 逆方向: Python が実在するときに案内文を出さないか ────────
  //   「Python が無い」と誤って案内すると、本当の失敗原因から目を逸らさせる。
  //   screening_result.json が無い状態の refresh_prices.py は
  //   ネットワークに出る前に exit=1 で終わるため、失敗の実例として使える。
  //   （このファイルがある環境では yfinance を呼んでしまうのでスキップする）
  if (existsSync(path.resolve('scripts/screening_result.json'))) {
    console.log('- 誤検知チェックはスキップ（scripts/screening_result.json があるため）');
  } else {
    dev = await startDev(5213);
    const real = await readSse('http://127.0.0.1:5213/api/refresh-prices');
    const realErr = real.events.find((e) => e.type === 'error');
    const noFalseHint = !!realErr && !/コマンドが見つかりません/.test(realErr.message ?? '');
    check('Python が実在するときは「見つかりません」と言わない', noFalseHint,
      realErr ? realErr.message : JSON.stringify(real.events.slice(-2)));
    if (!noFalseHint) dumpEvents('refresh-prices(正常な python)', real.events);
    stopDev(dev); dev = null;
    await new Promise((r) => setTimeout(r, 1000));
  }

  // ── ⑤ バックアップのフォルダ名が OS で作れるか ──────────────
  //   ISO日時をそのまま使うとコロンが入り、Windows では作成に失敗する。
  const created = backupDirs().filter((n) => !before.includes(n));
  check('実行前バックアップのフォルダが作られた', created.length > 0, created.join(', ') || '(なし)');
  check('バックアップのフォルダ名にコロンが含まれない',
    created.every((n) => !n.includes(':')), created.join(', '));
  check('バックアップのフォルダ名が想定の形式',
    created.every((n) => /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(n)), created.join(', '));
} catch (e) {
  console.log(`✗ 実行中に例外: ${e.message}`);
  failures++;
} finally {
  stopDev(dev);
}

console.log('\n注: このチェックは scripts/backup/ にバックアップフォルダを1つ作ります'
  + '（フォルダ名が OS で作れるかの確認のため）。ローカルで実行した場合は手で消してください。');
console.log(`\n=== ${failures === 0 ? 'すべて通過' : `${failures} 件失敗`} ===`);
process.exit(failures === 0 ? 0 : 1);
