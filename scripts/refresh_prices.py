"""
株価だけを取り直す軽量更新スクリプト
使い方: python3 scripts/refresh_prices.py

なぜ分けるか:
  株価は毎営業日動くが、財務（EDINET）は四半期に一度しか変わらない。
  フルスクリーニングは872社を走査して約13分・EDINETを80リクエスト消費するため、
  株価鮮度のために回すには重すぎる。
  本スクリプトは screening_result.json に載っている銘柄だけを対象に
  株価・PER・PBR・配当・52週高安を取り直す（15銘柄で約12秒・API消費0回）。

  財務データ（equityRatio / trapFlag / scoreBreakdown / edinetDetail など）は
  一切触らない。取り直していないものを新しく見せないため。
"""
import sys, json, time, warnings
from datetime import date

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
warnings.filterwarnings('ignore')

sys.path.insert(0, 'scripts')
from fetch_stocks import fetch_yfinance   # noqa: E402

RESULT_PATH = 'scripts/screening_result.json'
META_PATH = 'scripts/screening_meta.json'

# 株価更新で置き換える項目。ここに無いものは財務由来なので触らない。
PRICE_FIELDS = ('price', 'per', 'pbr', 'roe', 'dividend', 'market_cap', 'high_52w', 'low_52w')


def main() -> int:
    try:
        with open(RESULT_PATH, 'r', encoding='utf-8') as f:
            stocks = json.load(f)
    except FileNotFoundError:
        print(f'エラー: {RESULT_PATH} が見つかりません。先に fetch_stocks.py を実行してください。')
        return 1

    print(f'=== 株価更新開始（{len(stocks)}銘柄）===\n')

    updated, failed = 0, []
    quote_dates = []      # 取得できた株価が「いつ時点か」
    for s in stocks:
        code = s['code']
        fresh = fetch_yfinance(code)
        if not fresh:
            # 取れなかった銘柄は古い値を残したままにせず、失敗として明示する。
            failed.append(code)
            print(f'  ✗ {code} {s["name"][:10]} 取得失敗（前回値を保持）')
            continue

        old_price = s.get('price')
        for key in PRICE_FIELDS:
            if key in fresh:
                s[key] = fresh[key]
        if fresh.get('price_date'):
            quote_dates.append(fresh['price_date'])
            s['price_date'] = fresh['price_date']

        diff = ''
        if old_price:
            pct = (fresh['price'] - old_price) / old_price * 100
            diff = f'  {pct:+.1f}%'
        print(f'  ✓ {code} {s["name"][:10]:<12} {old_price:>7,.0f} → {fresh["price"]:>7,.0f}円{diff}')
        updated += 1
        time.sleep(0.2)

    with open(RESULT_PATH, 'w', encoding='utf-8') as f:
        json.dump(stocks, f, ensure_ascii=False, indent=2)

    # 株価の取得日をメタに記録する。財務の取得日（runDate）とは別に持つ。
    try:
        with open(META_PATH, 'r', encoding='utf-8') as f:
            meta = json.load(f)
    except FileNotFoundError:
        meta = {}
    # 実行日ではなく、実際に値が付いた日を記録する。
    # 夜間や休日に実行すると date.today() は前営業日の終値に当日の日付を貼ってしまい、
    # 鮮度バナーが1日ぶん新しく見える。銘柄ごとに差が出た場合はいちばん古い日を採る
    # （「全銘柄が少なくともこの日時点」と言える側に倒す）。
    meta['priceDate'] = min(quote_dates) if quote_dates else date.today().isoformat()
    meta['priceFailedCount'] = len(failed)
    if quote_dates and min(quote_dates) != max(quote_dates):
        print(f'  ※ 銘柄によって株価の基準日が異なります（{min(quote_dates)}〜{max(quote_dates)}）。'
              f'いちばん古い {min(quote_dates)} を鮮度判定に使います。')
    with open(META_PATH, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f'\n更新: {updated}銘柄 / 失敗: {len(failed)}銘柄 / 株価基準日: {meta["priceDate"]}')
    if failed:
        print(f'  失敗した銘柄: {", ".join(failed)}（前回の株価が残っています）')

    # data.ts への反映は update_data.py に任せる（data.ts を書く経路を1本にするため）
    print('\n=== ダッシュボードへ反映 ===')
    import update_data
    update_data.main()
    return 0


if __name__ == '__main__':
    sys.exit(main())
