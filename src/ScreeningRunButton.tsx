import { useEffect, useState } from 'react';
import { targetSectors, pipelineMeta } from './data';
import { calendarDaysSince } from './freshness';

/**
 * フルスクリーニングを実行するボタン。
 *
 * 【削除方法】このファイルを消し、ScreeningView.tsx の import と
 *   <ScreeningRunButton /> の2行を消せば元に戻る。
 *   サーバ側は vite-plugin-macro.ts の「BEGIN/END: フルスクリーニング実行」ブロック。
 * 【一時的に止める】.env.local に DISABLE_SCREENING_RUN=1 を書いてブラウザを再読込
 *   → ボタンが消え、エンドポイントも 403 を返す。スイッチはこの1箇所だけ。
 *
 * 株価更新（約12秒・API0回）と違い、この処理は
 *   ・約10〜13分かかる
 *   ・EDINET DB を最大80回消費する（無料枠100回/日）
 *   ・現在の15社を別の銘柄に入れ替える
 * ため、押した瞬間に走らせず必ず確認ダイアログを挟む。
 */

type Status = 'idle' | 'running' | 'done' | 'error';

// 有効/無効と前回実行日はサーバに聞く。
// クライアント側に別のフラグを置くと、切り忘れて片方だけ生きる事故になる。
type ServerState = { enabled: boolean; lastRunDate: string | null; inFlight: boolean; today: string };

export default function ScreeningRunButton() {
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);
  const [server, setServer] = useState<ServerState | null>(null);

  useEffect(() => {
    fetch('/api/screening-status')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setServer(d))
      .catch(() => setServer({ enabled: false, lastRunDate: null, inFlight: false, today: '' }));
  }, []);

  const industries = targetSectors.map(s => s.code).join(',');
  const preset = pipelineMeta.preset;
  // 「本日すでに実行済みか」はサーバの screening_meta.json を正とする。
  // data.ts の runDate は反映待ちでずれることがある。
  const ranToday = server != null && server.lastRunDate === server.today;
  const lastRunDate = server?.lastRunDate ?? pipelineMeta.runDate;
  const runDays = calendarDaysSince(lastRunDate);
  const running = status === 'running';

  // 状態取得前、または無効化されている場合はボタンごと出さない
  if (server === null || !server.enabled) return null;

  const run = async (force: boolean) => {
    const ac = new AbortController();
    setController(ac);
    setConfirming(false);
    setAcknowledged(false);
    setStatus('running');
    setLogs([]);
    setMessage(null);

    const qs = new URLSearchParams({ industries, preset, top: '15' });
    if (force) qs.set('force', '1');

    try {
      const res = await fetch(`/api/run-screening?${qs}`, { method: 'POST', signal: ac.signal });
      if (!res.ok || !res.body) {
        // 403（無効化）/409（実行中）/429（同日2回目）はサーバの本文が理由を持つ
        const text = await res.text().catch(() => '');
        throw new Error(text || `APIエラー: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          try {
            const evt = JSON.parse(json) as { type: string; message?: string };
            if (evt.type === 'log' && evt.message) {
              setLogs(prev => [...prev, evt.message!]);
            } else if (evt.type === 'done') {
              setStatus('done');
              setMessage(evt.message ?? '完了');
            } else if (evt.type === 'error') {
              setStatus('error');
              setMessage(evt.message ?? 'エラー');
            }
          } catch {
            // JSON parse 失敗は無視
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setStatus('error');
        setMessage('中止しました。data.ts は変更されていません');
        return;
      }
      setStatus('error');
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        disabled={running}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
          running
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'bg-white text-amber-800 border-amber-400 hover:bg-amber-50'
        }`}
      >
        {running ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            <span>スクリーニング実行中...</span>
          </>
        ) : (
          <>
            <span>⟳</span>
            <span>銘柄を選び直す</span>
          </>
        )}
      </button>

      {/* ── 確認ダイアログ ── 押した瞬間には走らせない ── */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setConfirming(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-900">フルスクリーニングを実行しますか？</h3>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5 text-xs text-amber-900">
              <div className="font-semibold">実行すると次のことが起きます</div>
              <div>• <strong>約10〜13分</strong>かかります</div>
              <div>• <strong>EDINET DB を最大80回</strong>消費します（無料枠 100回/日）</div>
              <div>• <strong>現在の15社が別の銘柄に入れ替わります</strong></div>
              <div>• マクロ分析・株価は変わりません</div>
            </div>

            <dl className="text-xs space-y-1.5">
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">対象業種</dt>
                <dd className="text-gray-800">
                  {targetSectors.map(s => s.name).join('・')}
                  <span className="text-gray-400 font-mono ml-1">({industries})</span>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">プリセット</dt>
                <dd className="text-gray-800 font-mono">{preset}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">前回の実行</dt>
                <dd className={ranToday ? 'text-red-700 font-semibold' : 'text-gray-800'}>
                  {lastRunDate}
                  {runDays !== null && `（${runDays <= 0 ? '本日' : `${runDays}日前`}）`}
                  {ranToday && ' ← 本日すでに実行済み'}
                </dd>
              </div>
            </dl>

            {ranToday && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
                本日はすでに実行済みです。もう一度実行すると EDINET の無料枠を使い切る可能性があります。
                キャッシュが効いていれば消費は少なく済みますが、保証はありません。
              </div>
            )}

            <p className="text-[11px] text-gray-500">
              実行前に <code className="font-mono">src/data.ts</code> と
              スクリーニング結果を <code className="font-mono">scripts/backup/</code> へ退避します。
              失敗・中止した場合、画面のデータは変更されません。
            </p>

            <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={e => setAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              <span>所要時間とEDINETの消費、銘柄が入れ替わることを理解しました</span>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setConfirming(false); setAcknowledged(false); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                やめる
              </button>
              <button
                onClick={() => run(ranToday)}
                disabled={!acknowledged}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${
                  acknowledged ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 実行ログ ── */}
      {status !== 'idle' && (
        <div className="fixed bottom-4 right-4 z-40 w-[30rem] max-w-[calc(100vw-2rem)] rounded-xl border bg-white shadow-lg p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-xs font-bold ${
                status === 'error' ? 'text-red-700'
                : status === 'done' ? 'text-emerald-700'
                : 'text-blue-700'
              }`}
            >
              {running && 'スクリーニング実行中（10〜13分）...'}
              {status === 'done' && `✓ ${message}`}
              {status === 'error' && `✗ ${message}`}
            </span>
            <div className="flex gap-2 shrink-0">
              {running && (
                <button
                  onClick={() => controller?.abort()}
                  className="text-xs px-2 py-0.5 rounded border border-red-300 text-red-700 hover:bg-red-50"
                >
                  中止
                </button>
              )}
              {!running && (
                <button onClick={() => setStatus('idle')} className="text-gray-400 hover:text-gray-600 text-xs">
                  ✕ 閉じる
                </button>
              )}
            </div>
          </div>

          <div className="bg-gray-900 text-gray-100 rounded-lg p-2.5 text-[11px] font-mono max-h-64 overflow-y-auto">
            {logs.length === 0
              ? <div className="text-gray-500">起動中...</div>
              : logs.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words leading-relaxed">{line}</div>
                ))}
          </div>

          {status === 'done' && (
            <div className="text-[11px] text-emerald-700">
              data.ts が更新されました。画面は自動でリロードされます。
            </div>
          )}
        </div>
      )}
    </>
  );
}
