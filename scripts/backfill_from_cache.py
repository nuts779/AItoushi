"""
scripts/cache/edinet/raw/ に既にあるEDINETデータだけを使って
screening_result.json の財務由来フィールドを再計算する。

APIリクエストは1回も発行しない（キャッシュファイルを直接読む）。
罠検出ルールの追加やフィールド追加を、スクリーニング13分を回さずに
既存15社へ反映するための補助スクリプト。

制限: screening_result.json に残っている銘柄しか対象にできないため、
      16位以下が浮上する再ランキングはできない。順位は15社内でのみ入れ替わる。

使い方: python3 scripts/backfill_from_cache.py
"""
import sys, json
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, str(Path(__file__).parent))
from edinet_fetcher import (extract_metrics, extract_detail, detect_trap_v2,
                            calc_freshness_edinet, calc_score_breakdown, RULE_LABELS)

CACHE = Path('scripts/cache/edinet')
RESULT = Path('scripts/screening_result.json')
UNDETERMINED_ALL = [f'{lbl}: 財務データを取得できていない' for lbl in RULE_LABELS]


def load_company(sec_code: str, code_map: dict) -> dict | None:
    """キャッシュファイルから fetch_company() と同じ形の dict を組み立てる。"""
    entry = code_map.get(sec_code)
    if not entry:
        return None
    ec = entry['edinet_code']
    fin_path  = CACHE / 'raw' / f'companies_{ec}_financials.json'
    earn_path = CACHE / 'raw' / f'companies_{ec}_earnings.json'
    if not fin_path.exists():
        return None
    fin = json.loads(fin_path.read_text(encoding='utf-8'))
    earn = json.loads(earn_path.read_text(encoding='utf-8')) if earn_path.exists() else {}
    return {
        'edinet_code': ec,
        'accounting_standard': entry.get('accounting_standard', 'JP'),
        'financials': fin.get('data', []),
        'earnings': earn.get('data', {}).get('earnings', []),
    }


def main() -> None:
    stocks = json.loads(RESULT.read_text(encoding='utf-8'))
    code_map = json.loads((CACHE / 'code_map.json').read_text(encoding='utf-8'))
    print(f'{len(stocks)}社を対象にキャッシュから再計算します（APIリクエスト0回）\n')

    hit = miss = 0
    for s in stocks:
        company = load_company(s['code'], code_map)
        if not company or not company['financials']:
            miss += 1
            print(f"  ✗ {s['code']} {s['name'][:12]:<14} キャッシュなし → unavailable のまま")
            s.update({
                'trapUndetermined': UNDETERMINED_ALL,
                'dataSource': 'unavailable',
            })
            continue

        hit += 1
        metrics = extract_metrics(company)
        detail = extract_detail(company)
        breakdown = calc_score_breakdown(metrics, s)
        flag, reasons, undet, penalty = detect_trap_v2(metrics)
        deep = min(100, max(0, s['score'] + penalty))
        eq = metrics.get('equity_ratio', 50) or 50

        before = s['deepScore']
        s.update({
            'deepScore': deep,
            'trapFlag': flag,
            'trapReasons': reasons,
            'trapUndetermined': undet,
            'freshness': calc_freshness_edinet(metrics.get('disclosure_date')),
            'irbankDate': metrics.get('disclosure_date') or s.get('irbankDate'),
            'equityRatio': eq,
            'dataSource': 'edinet_db',
            'edinetDetail': detail,
            'scoreBreakdown': breakdown,
        })

        mark = '⚠' if flag != 'normal' else '✓'
        delta = f'{before}→{deep}' if before != deep else f'{deep}'
        print(f"  {mark} {s['code']} {s['name'][:12]:<14} score:{delta:<8} [{flag}] "
              f"罠{len(reasons)}件 / 判定不能{len(undet)}件")
        for r in reasons:
            print(f"        └ {r}")

    stocks.sort(key=lambda x: x['deepScore'], reverse=True)
    for i, s in enumerate(stocks):
        s['rank'] = i + 1

    RESULT.write_text(json.dumps(stocks, ensure_ascii=False, indent=2), encoding='utf-8')

    dangerous  = sum(1 for s in stocks if s['trapFlag'] == 'dangerous')
    suspicious = sum(1 for s in stocks if s['trapFlag'] == 'suspicious')
    undet_avg  = sum(len(s.get('trapUndetermined', [])) for s in stocks) / max(1, len(stocks))
    print(f'\n再計算完了: キャッシュあり{hit}社 / なし{miss}社')
    print(f'  罠: dangerous={dangerous} suspicious={suspicious} normal={len(stocks)-dangerous-suspicious}')
    print(f'  判定不能ルール数の平均: {undet_avg:.1f}件/社')
    print(f'✓ {RESULT} を更新しました。続けて python3 scripts/update_data.py を実行してください。')


if __name__ == '__main__':
    main()
