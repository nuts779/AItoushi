"""
screening_result.json を読み込み src/data.ts の screeningStocks を上書きする
使い方: python scripts/update_data.py
"""
import sys, io, json, re
from datetime import datetime, date
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 配当利回りの異常値上限（yfinanceの取得ミスを除外）
DIV_MAX = 20.0

def parse_iso_date(s: str) -> str:
    """HTTP日付形式やISO形式をYYYY-MM-DDに正規化する"""
    if not s:
        return date.today().isoformat()
    # ISO形式はそのまま
    if re.match(r'^\d{4}-\d{2}-\d{2}', s):
        return s[:10]
    # HTTP日付形式: "Fri, 13 Feb 2026 00:00:00 GMT"
    for fmt in ('%a, %d %b %Y %H:%M:%S %Z', '%a, %d %b %Y %H:%M:%S GMT'):
        try:
            return datetime.strptime(s.strip(), fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
    return date.today().isoformat()

def to_ts_value(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, str): return f"'{v}'"
    if isinstance(v, list):
        items = ', '.join(to_ts_value(i) for i in v)
        return f'[{items}]'
    return str(v)

def generate_stock_ts(s: dict) -> str:
    div = s.get('dividend', 0) or 0
    if div > DIV_MAX:
        div = 0  # yfinance 取得ミスと判断して0に
    eq = round(s.get('equityRatio', 50) or 50, 1)
    irbank_date = parse_iso_date(s.get('irbankDate', ''))
    # dataSource: 'edinet_db' or 'irbank'（irbank_fallback → irbank に正規化）
    raw_src = s.get('dataSource', 'irbank')
    data_source = 'edinet_db' if raw_src == 'edinet_db' else 'irbank'
    lines = [
        f"  {{",
        f"    rank: {s['rank']}, code: '{s['code']}', name: '{s['name']}', industryCode: '{s['industryCode']}', industry: '{s['industry']}',",
        f"    price: {s['price']}, per: {to_ts_value(s.get('per'))}, pbr: {s.get('pbr', 0)}, roe: {s.get('roe', 0)}, dividendYield: {div}, marketCap: {s.get('market_cap', 0)},",
        f"    score: {s['score']}, deepScore: {s['deepScore']}, trapFlag: '{s['trapFlag']}', freshness: '{s['freshness']}', irbankDate: '{irbank_date}',",
        f"    equityRatio: {eq}, high52w: {s.get('high_52w', s['price'])}, consecutiveDividendYears: {s.get('consecutiveDividendYears', 0)}, trapReasons: {to_ts_value(s.get('trapReasons', []))},",
        f"    dataSource: '{data_source}',",
        f"  }}",
    ]
    return '\n'.join(lines)

def main():
    try:
        with open('scripts/screening_result.json', 'r', encoding='utf-8') as f:
            stocks = json.load(f)
    except FileNotFoundError:
        print('エラー: scripts/screening_result.json が見つかりません。先に fetch_stocks.py を実行してください。')
        sys.exit(1)

    print(f'screening_result.json から {len(stocks)}社を読み込みました')

    with open('src/data.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    new_stocks_ts = ',\n'.join(generate_stock_ts(s) for s in stocks)
    new_array = f'export const screeningStocks: Stock[] = [\n{new_stocks_ts},\n];'

    pattern = r'(?:// JPX実データ[^\n]*\n// rank[^\n]*\n)?export const screeningStocks: Stock\[\] = \[.*?^];'
    replacement = f'// JPX実データ（取得日: {date.today()}）\n// rank は deepScore 降順で付番\n{new_array}'
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL | re.MULTILINE)

    if new_content == content:
        print('警告: screeningStocks の置換対象が見つかりませんでした。data.ts を確認してください。')
        sys.exit(1)

    with open('src/data.ts', 'w', encoding='utf-8') as f:
        f.write(new_content)

    print('✓ src/data.ts を更新しました！')
    print('  Vite dev server が起動中であれば、ブラウザが自動更新されます。')

    dangerous  = sum(1 for s in stocks if s['trapFlag'] == 'dangerous')
    suspicious = sum(1 for s in stocks if s['trapFlag'] == 'suspicious')
    fresh      = sum(1 for s in stocks if s['freshness'] == 'fresh')
    div_fixed  = sum(1 for s in stocks if (s.get('dividend') or 0) > DIV_MAX)
    print(f'\n【反映サマリー】')
    print(f'  銘柄数: {len(stocks)}社')
    print(f'  罠検出: dangerous={dangerous} suspicious={suspicious}')
    print(f'  鮮度fresh: {fresh}社')
    if div_fixed:
        print(f'  配当利回り異常値修正: {div_fixed}社（yfinance取得ミスを0に補正）')

if __name__ == '__main__':
    main()
