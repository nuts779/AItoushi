import { edinetDetails } from './data';
import type { EdinetDetail } from './types';

// 一次資料（有報・決算短信PDF）へのリンク。
// 数値だけを見せて出所に飛べない状態を作らないための部品。
// URLが無い項目はリンクを作らず、何も無ければ理由を添えて「—」を出す。

type Size = 'sm' | 'md';

const sizeCls: Record<Size, string> = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
};

export function SourceLinks({ d, size = 'sm', showTitle = false, compact = false }: {
  d?: EdinetDetail; size?: Size; showTitle?: boolean; compact?: boolean;
}) {
  const links = [
    { url: d?.edinetUrl, label: '有報', title: 'EDINET提出書類（有価証券報告書）' },
    { url: d?.earningsPdfUrl, label: compact ? '短信' : '決算短信', title: d?.earningsTitle ?? '決算短信PDF' },
  ].filter(l => l.url);

  if (links.length === 0) {
    // 表の中では行の高さを崩さないよう「—」だけにする
    return compact
      ? <span className="text-gray-300">—</span>
      : <span className="text-xs text-gray-400">一次資料のURLを取得できていません</span>;
  }

  return (
    <span className="flex gap-1.5 flex-wrap items-center">
      {links.map(l => (
        <a
          key={l.label}
          href={l.url as string}
          target="_blank"
          rel="noopener noreferrer"
          title={l.title}
          className={`${sizeCls[size]} rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap`}
        >
          {l.label} ↗
        </a>
      ))}
      {showTitle && d?.earningsTitle && (
        <span className="text-xs text-gray-400">{d.earningsTitle}</span>
      )}
    </span>
  );
}

export function SourceLinksByCode({ code, size, showTitle, compact }: {
  code: string; size?: Size; showTitle?: boolean; compact?: boolean;
}) {
  return (
    <SourceLinks
      d={edinetDetails.find(e => e.code === code)}
      size={size}
      showTitle={showTitle}
      compact={compact}
    />
  );
}
