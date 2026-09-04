// 財務データの取得元の表示ルールを1か所に集約する。
// 'unavailable'（取得失敗）を IRBANK などに読み替えないことが要点。
// 取れなかったものを取れたように見せると、鮮度を保証できなくなる。

export type DataSource = 'edinet_db' | 'irbank' | 'unavailable';

type Style = { label: string; short: string; badge: string; text: string };

const styles: Record<DataSource, Style> = {
  edinet_db: {
    label: 'EDINET DB（有報）',
    short: 'EDINET DB',
    badge: 'bg-blue-50 text-blue-700 border border-blue-200',
    text: 'text-blue-700',
  },
  irbank: {
    label: 'IRBANK',
    short: 'IRBANK',
    badge: 'bg-gray-100 text-gray-600 border border-gray-200',
    text: 'text-gray-600',
  },
  unavailable: {
    label: '未取得（要確認）',
    short: '未取得',
    badge: 'bg-red-50 text-red-700 border border-red-200',
    text: 'text-red-600',
  },
};

// dataSource が未設定の古いデータは「取得できていない」とみなす（安全側に倒す）
export function sourceStyle(src?: string): Style {
  return styles[(src as DataSource) in styles ? (src as DataSource) : 'unavailable'];
}

export function isUnavailable(src?: string): boolean {
  return src !== 'edinet_db' && src !== 'irbank';
}
