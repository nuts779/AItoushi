import { useState } from 'react';

/**
 * 株価だけを取り直すボタン。
 *
 * マクロ分析の更新と違い Claude を呼ばないため、実行しても課金は発生しない。
 * 対象は現在ダッシュボードに載っている銘柄のみで、所要は10〜20秒程度。
 */
type Status = 'idle' | 'running' | 'done' | 'error';

export default function PriceRefreshButton() {
  const [status, setStatus] = useState<Status>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const run = async () => {
    setStatus('running');
    setLogs([]);
    setMessage(null);
    setOpen(true);

    try {
      const res = await fetch('/api/refresh-prices', { method: 'POST' });
      if (!res.ok || !res.body) throw new Error(`APIエラー: ${res.status}`);

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
      setStatus('error');
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const running = status === 'running';

  return (
    <div className="relative">
      <button
        onClick={run}
        disabled={running}
        title="現在表示中の銘柄の株価・PER・PBR・配当を取り直します（課金なし）"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
          running
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        {running ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            <span>更新中...</span>
          </>
        ) : (
          <>
            <span>↻</span>
            <span>株価を更新</span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-20 w-96 rounded-xl border bg-white shadow-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold ${
                status === 'error' ? 'text-red-700'
                : status === 'done' ? 'text-emerald-700'
                : 'text-blue-700'
              }`}
            >
              {status === 'running' && '株価を取得しています...'}
              {status === 'done' && `✓ ${message}`}
              {status === 'error' && `✗ ${message}`}
            </span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">
              ✕ 閉じる
            </button>
          </div>

          <div className="bg-gray-900 text-gray-100 rounded-lg p-2.5 text-[11px] font-mono max-h-56 overflow-y-auto">
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
          {status === 'error' && (
            <div className="text-[11px] text-red-700">
              Python が実行できるか確認してください（既定: python3）。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
