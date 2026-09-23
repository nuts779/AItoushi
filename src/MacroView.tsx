import { useState, useRef, useEffect } from 'react';
import { economistReports, targetSectors, avoidSectors, weather, weatherDetail, screeningCommandArgs, macroMeta } from './data';
import { calendarDaysSince, MACRO_DAYS } from './freshness';
import { usePythonEnv, buildCommand, PythonBinNote } from './pythonCommand';

const weatherConfig = {
  '晴れ': { icon: '☀️', bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', sub: 'text-emerald-500' },
  '曇り': { icon: '⛅', bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-700',  sub: 'text-amber-500' },
  '嵐':   { icon: '⛈️', bg: 'bg-red-50',     border: 'border-red-300',     text: 'text-red-700',    sub: 'text-red-500' },
} as const;

type MacroStatus = 'idle' | 'running' | 'done' | 'error';

export default function MacroView() {
  const [copied, setCopied] = useState(false);
  const [macroStatus, setMacroStatus] = useState<MacroStatus>('idle');
  const [macroLogs, setMacroLogs] = useState<string[]>([]);
  const [macroStep, setMacroStep] = useState<number>(0);
  const [macroError, setMacroError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const cfg = weatherConfig[weather];
  const logBoxRef = useRef<HTMLDivElement>(null);

  // Python の実行コマンド名は OS で違うため、サーバ（自分の npm run dev）に問い合わせる
  const pyEnv = usePythonEnv();
  const screeningCommand = buildCommand(pyEnv.bin, screeningCommandArgs);

  const handleCopy = () => {
    // 表示している文字列と同じものをコピーする。
    // python3 を固定で入れると Windows のメンバーが貼っても動かない（BUG-019）。
    navigator.clipboard.writeText(screeningCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ログ追加時に自動スクロール
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [macroLogs]);

  const handleMacroFetch = async () => {
    setMacroStatus('running');
    setMacroLogs([]);
    setMacroStep(0);
    setMacroError(null);
    setPanelOpen(true);

    try {
      const res = await fetch('/api/fetch-macro', { method: 'POST' });
      if (!res.ok || !res.body) {
        throw new Error(`APIエラー: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE の "data: {...}\n\n" を行単位でパース
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          try {
            const evt = JSON.parse(json) as { type: string; message?: string; step?: number };
            if (evt.type === 'log' && evt.message) {
              setMacroLogs(prev => [...prev, evt.message!]);
            } else if (evt.type === 'step' && evt.message) {
              if (evt.step) setMacroStep(evt.step);
              setMacroLogs(prev => [...prev, `━━━ ${evt.message} ━━━`]);
            } else if (evt.type === 'done') {
              setMacroStatus('done');
              setMacroLogs(prev => [...prev, `✓ ${evt.message ?? '完了'}`]);
            } else if (evt.type === 'error') {
              setMacroStatus('error');
              setMacroError(evt.message ?? 'エラー');
              setMacroLogs(prev => [...prev, `✗ ${evt.message ?? 'エラー'}`]);
            }
          } catch {
            // JSON parse 失敗は無視
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMacroStatus('error');
      setMacroError(msg);
      setMacroLogs(prev => [...prev, `✗ ${msg}`]);
    }
  };

  const isRunning = macroStatus === 'running';

  return (
    <div className="space-y-8">
      {/* Weather + Summary */}
      <div className="flex gap-6 flex-wrap">
        <div className={`${cfg.bg} border-2 ${cfg.border} rounded-xl p-6 flex flex-col items-center justify-center min-w-40 shadow-sm`}>
          <div className="text-5xl mb-2">{cfg.icon}</div>
          <div className={`text-2xl font-bold ${cfg.text}`}>{weather}</div>
          <div className={`${cfg.sub} text-xs mt-1 text-center`}>相場の天気</div>
        </div>
        <div className="flex-1 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-2">相場環境サマリー</h2>
          <p className="text-gray-600 text-sm mb-4">{weatherDetail}</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-emerald-700 font-semibold mb-1">▲ 追い風</div>
              <div className="text-gray-600">内需DX、インフラ投資、賃上げ消費回復</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-600 font-semibold mb-1">▼ 逆風</div>
              <div className="text-gray-600">米国関税リスク、地政学、原油高、中国景気</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Economist Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">3エコノミスト分析</h2>
          <div className="flex items-center gap-3">
            {/* 記事の日付と、分析を走らせた日は別物。
                記事が新しくても分析が1か月前ということがあるため両方出す。 */}
            <div className="text-right">
              <div className="text-gray-400 text-xs">参考記事の最新日</div>
              <div className="text-gray-700 text-sm font-mono font-semibold">{macroMeta.latestArticleDate}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-xs">この分析の実行日</div>
              {(() => {
                const d = macroMeta.generatedDate ?? null;
                const days = calendarDaysSince(d);
                const cls =
                  days === null ? 'text-red-500'
                  : days <= MACRO_DAYS.fresh ? 'text-emerald-600'
                  : days <= MACRO_DAYS.warn ? 'text-amber-600'
                  : 'text-red-500';
                return (
                  <div className={`text-sm font-mono font-semibold ${cls}`}>
                    {d ?? '不明'}
                    {days !== null && (
                      <span className="text-xs font-normal ml-1">
                        （{days <= 0 ? '本日' : `${days}日前`}）
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
            <button
              onClick={handleMacroFetch}
              disabled={isRunning}
              className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm ${
                isRunning
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isRunning ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>分析中...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>マクロ分析を更新</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 進捗/結果パネル */}
        {panelOpen && (
          <div className={`mb-5 border rounded-xl p-5 space-y-3 ${
            macroStatus === 'error' ? 'bg-red-50 border-red-200' :
            macroStatus === 'done'  ? 'bg-emerald-50 border-emerald-200' :
                                       'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-sm ${
                macroStatus === 'error' ? 'text-red-800' :
                macroStatus === 'done'  ? 'text-emerald-800' :
                                           'text-blue-800'
              }`}>
                {macroStatus === 'running' && '⚙️ マクロ分析を実行中...'}
                {macroStatus === 'done'    && '✓ マクロ分析が完了しました'}
                {macroStatus === 'error'   && '✗ エラーが発生しました'}
                {macroStatus === 'idle'    && 'マクロ分析'}
              </h3>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕ 閉じる
              </button>
            </div>

            {/* ステップインジケーター */}
            <div className="flex items-center gap-2 text-xs">
              {[
                { n: 1, label: '記事取得' },
                { n: 2, label: 'AI分析' },
                { n: 3, label: '反映' },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    macroStep > s.n || macroStatus === 'done'
                      ? 'bg-emerald-500 text-white'
                      : macroStep === s.n
                      ? 'bg-blue-500 text-white animate-pulse'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {macroStep > s.n || macroStatus === 'done' ? '✓' : s.n}
                  </div>
                  <span className={
                    macroStep >= s.n || macroStatus === 'done' ? 'text-gray-700 font-medium' : 'text-gray-400'
                  }>
                    {s.label}
                  </span>
                  {i < 2 && <span className="text-gray-300">→</span>}
                </div>
              ))}
            </div>

            {/* ログ表示 */}
            <div
              ref={logBoxRef}
              className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono max-h-64 overflow-y-auto"
            >
              {macroLogs.length === 0 ? (
                <div className="text-gray-500">起動中...</div>
              ) : (
                macroLogs.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words leading-relaxed">
                    {line}
                  </div>
                ))
              )}
            </div>

            {macroStatus === 'error' && macroError && (
              <div className="text-xs text-red-700 bg-red-100 border border-red-200 rounded p-2">
                <strong>失敗の原因:</strong> {macroError}
                <div className="mt-1 text-red-600">
                  Python / Claude Code CLI がインストール済みか確認してください。
                </div>
              </div>
            )}

            {macroStatus === 'done' && (
              <div className="text-xs text-emerald-700">
                data.ts が更新されました。Viteの自動リロードで画面が更新されます。
              </div>
            )}

            {/* ソース */}
            <div className="pt-2 border-t border-gray-200">
              <div className="text-gray-600 text-xs font-semibold mb-1.5">取得対象ソース</div>
              <div className="flex flex-wrap gap-2">
                {economistReports.map((r, i) => (
                  r.url && (
                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs bg-white border border-gray-200 px-2 py-1 rounded hover:bg-gray-100 text-gray-700 transition-colors">
                      {r.name}（{r.org}）↗
                    </a>
                  )
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {economistReports.map((report, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-gray-900 font-semibold">{report.name}</div>
                  <div className="text-emerald-600 text-xs font-medium">{report.org}</div>
                  <div className="text-gray-400 text-xs">{report.role}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-gray-400 text-xs bg-gray-100 px-2 py-0.5 rounded">{report.date}</span>
                  {report.url && (
                    <a href={report.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-700 hover:underline">
                      最新記事 ↗
                    </a>
                  )}
                </div>
              </div>
              <ul className="space-y-2">
                {report.topics.map((topic, j) => (
                  <li key={j} className="flex gap-2 text-sm text-gray-600">
                    <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                    <span>{topic}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Target / Avoid Sectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-gray-900 font-bold mb-4 flex items-center gap-2">
            <span className="text-emerald-600">▲</span> 狙うセクター（業種コード付き）
          </h3>
          <div className="space-y-3">
            {targetSectors.map((s, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2 py-0.5 rounded font-mono shrink-0">
                  {s.code}
                </span>
                <div>
                  <div className="text-gray-800 text-sm font-medium">{s.name}</div>
                  <div className="text-gray-500 text-xs">{s.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-gray-900 font-bold mb-4 flex items-center gap-2">
            <span className="text-red-500">▼</span> 避けるセクター
          </h3>
          <div className="space-y-3">
            {avoidSectors.map((s, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-red-500 mt-0.5 shrink-0 font-bold">✕</span>
                <div>
                  <div className="text-gray-800 text-sm font-medium">{s.name}</div>
                  <div className="text-gray-500 text-xs">{s.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Command Generator */}
      <div className="bg-white border border-emerald-300 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-900 font-bold flex items-center gap-2">
            <span className="text-emerald-600">▶</span> Claude Code 実行コマンド
          </h3>
          <div className="flex gap-2 text-xs text-gray-500">
            <span className="bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">プリセット: stable_defensive</span>
            <span className="bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">財務: EDINET DB</span>
          </div>
        </div>

        {/* 現在の絞り込み業種（最新マクロから自動連動） */}
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg px-4 py-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-emerald-700">🎯 現在スクリーニングで絞り込む業種</span>
            <span className="text-[10px] text-emerald-600/80">（最新マクロ分析から自動連動・{targetSectors.length}業種）</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {targetSectors.map((s, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 bg-white border border-emerald-300 rounded-full px-2.5 py-1 text-xs">
                <span className="font-mono text-emerald-700 font-semibold">{s.code}</span>
                <span className="text-gray-700">{s.name}</span>
              </span>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-gray-500 font-mono">
            --industries {targetSectors.map((s) => s.code).join(',')}
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm text-emerald-700 mb-3 break-all">
          {screeningCommand}
        </div>
        <PythonBinNote env={pyEnv} />
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-xs">
            プロジェクトのフォルダで、ターミナル
            （Windows は PowerShell / コマンドプロンプト、macOS はターミナル）から上記を実行してください。<br />
            完了後に <code className="font-mono">{pyEnv.bin} scripts/update_data.py</code> を実行すると
            ステップ2の一覧に反映されます。
            「スクリーニング」タブの「銘柄を選び直す」ボタンからも同じ処理を実行できます。
          </p>
          <button
            onClick={handleCopy}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ml-4 ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
            }`}
          >
            {copied ? '✓ コピー済み' : 'コピー'}
          </button>
        </div>
      </div>
    </div>
  );
}
