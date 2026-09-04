"""
screening_result.json を読み込み src/data.ts の screeningStocks を上書きする
使い方: python scripts/update_data.py
"""
import sys, io, json, re
from datetime import datetime, date
# 出力を UTF-8 にする。新しい TextIOWrapper を被せると、
# 別スクリプトから import されたとき前のラッパーが破棄されて
# 元の buffer ごと閉じられてしまうため、reconfigure で既存の stdout を設定し直す。
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

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

def normalize_data_source(raw) -> str:
    """dataSource を data.ts が受け付ける3値に正規化する。

    'unavailable'（財務データ取得失敗）は絶対に他の値へ丸めない。
    丸めると「取れなかった」という事実が消え、鮮度を保証できない銘柄が
    取得済みとして表示されてしまう。
    """
    if raw in ('edinet_db', 'irbank', 'unavailable'):
        return raw
    if raw == 'irbank_fallback':
        return 'irbank'
    return 'unavailable' if raw in (None, '') else 'irbank'


def to_ts_value(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, str): return f"'{v}'"
    if isinstance(v, list):
        items = ', '.join(to_ts_value(i) for i in v)
        return f'[{items}]'
    return str(v)

def generate_breakdown_ts(b) -> str:
    """6項目評価のTSリテラルを生成する。算出できなかった項目は null のまま出す。"""
    if not b:
        return 'undefined'
    keys = ['catalyst', 'momentum', 'supply', 'valuation', 'downside', 'dividend']
    inner = ', '.join(f'{k}: {to_ts_value(b.get(k))}' for k in keys)
    return '{ ' + inner + ' }'


def generate_stock_ts(s: dict) -> str:
    div = s.get('dividend', 0) or 0
    if div > DIV_MAX:
        div = 0  # yfinance 取得ミスと判断して0に
    eq = round(s.get('equityRatio', 50) or 50, 1)
    # 財務未取得の銘柄に「今日」を入れると、基準日が最新であるかのように見えてしまう。
    # 日付が無いことは空文字で表し、画面側で「基準日なし」と出す。
    raw_date = s.get('irbankDate')
    irbank_date = parse_iso_date(raw_date) if raw_date else ''
    # dataSource は 'edinet_db' / 'irbank' / 'unavailable' の3値。
    # 以前は unavailable を irbank に丸めていたため、財務を取得できなかった銘柄が
    # 「IRBANKから取れた」ことになり、鮮度バナーの「財務未取得N件」が常に0だった。
    data_source = normalize_data_source(s.get('dataSource'))
    lines = [
        f"  {{",
        f"    rank: {s['rank']}, code: '{s['code']}', name: '{s['name']}', industryCode: '{s['industryCode']}', industry: '{s['industry']}',",
        f"    price: {s['price']}, per: {to_ts_value(s.get('per'))}, pbr: {s.get('pbr', 0)}, roe: {s.get('roe', 0)}, dividendYield: {div}, marketCap: {s.get('market_cap', 0)},",
        f"    score: {s['score']}, deepScore: {s['deepScore']}, trapFlag: '{s['trapFlag']}', freshness: '{s['freshness']}', irbankDate: '{irbank_date}',",
        f"    equityRatio: {eq}, high52w: {s.get('high_52w', s['price'])}, consecutiveDividendYears: {s.get('consecutiveDividendYears', 0)}, trapReasons: {to_ts_value(s.get('trapReasons', []))},",
        f"    dataSource: '{data_source}',",
        f"    scoreBreakdown: {generate_breakdown_ts(s.get('scoreBreakdown'))},",
        f"  }}",
    ]
    return '\n'.join(lines)

def patch_pipeline_meta(content: str, updates: dict) -> tuple[str, int]:
    """data.ts の pipelineMeta 内のキーを更新する（無ければ末尾に追加）。

    ダッシュボードのサマリーカードがここを参照するため、実行のたびに
    母集団・通過件数を実測値で上書きする。
    """
    m = re.search(r'(export const pipelineMeta = \{)(.*?)(\n\};)', content, re.DOTALL)
    if not m:
        return content, 0

    head, body, tail = m.group(1), m.group(2), m.group(3)
    for key, val in updates.items():
        # 値が無いキーは書き換えない。null で上書きすると、
        # 既存の実測値を「不明」に落としてしまう。
        if val is None:
            continue
        ts = to_ts_value(val)
        pattern = rf'(\n  {key}: )[^,\n]*(,)'
        if re.search(pattern, body):
            body = re.sub(pattern, lambda mm: f'{mm.group(1)}{ts}{mm.group(2)}', body, count=1)
        else:
            body = body + f'\n  {key}: {ts},'

    return content[:m.start()] + head + body + tail + content[m.end():], len(updates)


def generate_edinet_detail_ts(s: dict) -> str:
    """screening_result.json の1銘柄から edinetDetails の1要素を生成する。

    単位は edinet_fetcher.extract_detail() で換算済み:
      annual* = 億円 / 比率 = % / latest*・forecast* = 百万円
    財務詳細が無い銘柄（EDINET未取得など）は最小形（code/name/dataSource/fetchDate）で出力する。
    """
    data_source = normalize_data_source(s.get('dataSource'))
    head = (f"  {{\n"
            f"    code: '{s['code']}', name: '{s['name']}', "
            f"dataSource: '{data_source}', fetchDate: '{date.today()}',")

    d = s.get('edinetDetail') or {}
    if not d:
        return head + "\n  }"

    def v(key):
        return to_ts_value(d.get(key))

    lines = [
        head,
        f"    fiscalYear: {v('fiscalYear')}, annualEquityRatio: {v('annualEquityRatio')}, "
        f"annualROE: {v('annualROE')}, annualNetIncome: {v('annualNetIncome')}, "
        f"annualOrdinaryIncome: {v('annualOrdinaryIncome')}, annualRevenue: {v('annualRevenue')},",
        f"    latestQuarter: {v('latestQuarter')}, latestDisclosureDate: {v('latestDisclosureDate')}, "
        f"latestEquityRatio: {v('latestEquityRatio')},",
        f"    latestNetIncome: {v('latestNetIncome')}, latestNetIncomeChange: {v('latestNetIncomeChange')}, "
        f"forecastNetIncome: {v('forecastNetIncome')}, forecastNetIncomeChange: {v('forecastNetIncomeChange')},",
        "  }",
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
    # 置換件数で判定する。new_content == content で判定すると、
    # 同じ結果を再反映したとき（内容が変わらないだけ）を「置換失敗」と誤判定してしまう。
    new_content, hit = re.subn(pattern, replacement, content, count=1,
                               flags=re.DOTALL | re.MULTILINE)

    if hit == 0:
        print('警告: screeningStocks の置換対象が見つかりませんでした。data.ts を確認してください。')
        sys.exit(1)
    if new_content == content:
        print('  （screeningStocks の内容は前回と同一でした）')

    # edinetDetails を再生成する。
    # screeningStocks だけ差し替えると銘柄コードが噛み合わなくなり、
    # ポートフォリオ画面の「取得財務データ一覧」が空になる（L-07）。
    new_details_ts = ',\n'.join(generate_edinet_detail_ts(s) for s in stocks)
    new_details = f'export const edinetDetails: EdinetDetail[] = [\n{new_details_ts},\n];'
    detail_pattern = r'export const edinetDetails: EdinetDetail\[\] = \[.*?^\];'
    new_content, dhit = re.subn(detail_pattern, lambda _m: new_details, new_content, count=1,
                                flags=re.DOTALL | re.MULTILINE)
    if dhit == 0:
        print('警告: edinetDetails の置換対象が見つかりませんでした。財務データ一覧は古いままです。')
    else:
        with_detail = sum(1 for s in stocks if s.get('edinetDetail'))
        print(f'  edinetDetails を再生成しました（財務詳細あり {with_detail}/{len(stocks)}社）')

    # 実行メタ（母集団・通過件数）を pipelineMeta に反映する。
    # screening_meta.json は fetch_stocks.py が出力する。無い場合はスキップする
    # （古い結果を再反映しただけのケースで、実測値を消さないため）。
    try:
        with open('scripts/screening_meta.json', 'r', encoding='utf-8') as f:
            meta = json.load(f)
    except FileNotFoundError:
        meta = None
        print('  （scripts/screening_meta.json が無いため母集団件数は更新しません）')

    if meta:
        new_content, mhit = patch_pipeline_meta(new_content, {
            'preset':        meta.get('preset'),
            'universeCount': meta.get('universeCount'),
            'stage1Count':   meta.get('stage1Count'),
            'deepCount':     meta.get('deepCount'),
            'edinetCount':   meta.get('edinetCount'),
            'unavailableCount': meta.get('unavailableCount'),
            # 株価の取得日。財務の取得日（runDate）とは変化する頻度が違うため別に持つ。
            # 1つの日付で両方を代表させると、どちらかの鮮度が必ず嘘になる。
            'priceDate':     meta.get('priceDate'),
            'priceFailedCount': meta.get('priceFailedCount'),
        })
        if mhit:
            print(f"  母集団{meta.get('universeCount')} → 1段階目{meta.get('stage1Count')}"
                  f" → 深掘り{meta.get('deepCount')} を pipelineMeta に反映しました")
        else:
            print('警告: pipelineMeta が見つかりませんでした。')

    # pipelineMeta.runDate を実行日に更新する。
    # これを更新しないと、データは最新なのに鮮度バナーが「要更新」を出し続け、
    # 「古い値を黙って残さない」という本プロジェクトの方針と逆方向の嘘をつくことになる。
    # 反映日ではなく「スクリーニングを実行した日」を入れる。
    # 反映日を入れると、数日前のデータに今日の日付を貼って鮮度バナーを緑にしてしまい、
    # 「古い値を黙って残さない」方針と逆のことをしてしまう。
    run_date = (meta or {}).get('runDate') or date.today().isoformat()
    run_date_pattern = r"(runDate: ')\d{4}-\d{2}-\d{2}(')"
    new_content, n = re.subn(run_date_pattern, rf"\g<1>{run_date}\g<2>", new_content, count=1)
    if n == 0:
        print('警告: pipelineMeta.runDate の置換対象が見つかりませんでした。鮮度バナーは古い日付のままです。')
    else:
        print(f'  pipelineMeta.runDate を {run_date} に更新しました（スクリーニング実行日）')

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
