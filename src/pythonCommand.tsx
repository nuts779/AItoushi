import { useEffect, useState } from 'react';

/**
 * 画面に出す「実行してください」コマンドの Python 部分を、
 * サーバ（= 自分の PC で動いている npm run dev）が実際に使う値に合わせる。
 *
 * なぜサーバに聞くのか:
 *   Python の実行コマンド名は OS で違う（Windows: python / macOS・Linux: python3）。
 *   さらに PYTHON=py のような環境変数での上書きもできる。
 *   data.ts は Mac で生成したものを Windows のメンバーもそのまま使うため、
 *   コマンド名を data.ts に焼き込むと、受け取った側の画面では必ず嘘になる。
 *   鮮度タグを data.ts に凍結してはいけないのと同じ理由（BUG-013 / BUG-019）。
 *
 *   ブラウザは自分が載っている PC の OS までは知っているが、
 *   Python がどの名前で入っているかは知らない。実際に spawn する側だけが答えを持つ。
 */

type Source = 'loading' | 'server' | 'guess';

export type PythonEnv = {
  /** 実行コマンド名。'python' / 'python3' / PYTHON で上書きされた任意の値 */
  bin: string;
  /** server = サーバの実値 / guess = 問い合わせ失敗のためブラウザの OS から推定 */
  source: Source;
  /** PYTHON 環境変数で明示的に上書きされているか（サーバから取れた場合のみ true になりうる） */
  fromEnv: boolean;
};

/** サーバに聞けなかったときの推定。localhost 前提なので通常は当たるが、断定はしない。 */
function guessFromBrowser(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  return /Windows/i.test(ua) ? 'python' : 'python3';
}

// 画面内の複数箇所（マクロ画面・選定根拠パネルなど）から呼ばれるため、
// 取得結果はモジュール単位で共有する。fetch は最大1回。
let cached: PythonEnv | null = null;
let inflight: Promise<PythonEnv> | null = null;

function loadEnv(): Promise<PythonEnv> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = fetch('/api/env', { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((j: { pythonBin?: string; pythonFromEnv?: boolean }) => {
      if (!j?.pythonBin) throw new Error('pythonBin がありません');
      return { bin: j.pythonBin, source: 'server' as const, fromEnv: !!j.pythonFromEnv };
    })
    .catch(() => {
      // 握りつぶさず「推定である」ことを型に残す。画面側で注記を出す。
      return { bin: guessFromBrowser(), source: 'guess' as const, fromEnv: false };
    })
    .then((env) => {
      cached = env;
      inflight = null;
      return env;
    });
  return inflight;
}

export function usePythonEnv(): PythonEnv {
  const [env, setEnv] = useState<PythonEnv>(
    cached ?? { bin: guessFromBrowser(), source: 'loading', fromEnv: false },
  );
  useEffect(() => {
    let alive = true;
    loadEnv().then((e) => { if (alive) setEnv(e); });
    return () => { alive = false; };
  }, []);
  return env;
}

/** 引数部分（scripts/... 以降）に実行コマンド名を付けた全文を返す */
export function buildCommand(bin: string, args: string): string {
  return `${bin} ${args}`;
}

/**
 * サーバに聞けなかったときだけ出す注記。
 * 推定値をそのまま正しい値のように見せない（静かな劣化の禁止）。
 */
export function PythonBinNote({ env }: { env: PythonEnv }) {
  if (env.source !== 'guess') return null;
  return (
    <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
      ※ 実行コマンド名をサーバに確認できなかったため、ブラウザの OS から推定して表示しています
      （Windows は <code className="font-mono">python</code>、macOS / Linux は{' '}
      <code className="font-mono">python3</code>）。
      <code className="font-mono">npm run dev</code> が動いているか確認してください。
    </p>
  );
}

/** コマンドを1行の <code> として出す共通表示 */
export function PythonCommand({ args, className = '' }: { args: string; className?: string }) {
  const env = usePythonEnv();
  return (
    <code className={`font-mono ${className}`}>{buildCommand(env.bin, args)}</code>
  );
}
