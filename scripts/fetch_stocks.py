"""
日本株スクリーニングパイプライン
使い方:
  python scripts/fetch_stocks.py --industries 5250,2050 --preset stable_defensive --top 15

データソース（2026-06 再設計・鮮度保証方針）:
  - 株価/指標: yfinance（当日終値・補助。将来 J-Quants Light を主軸に差し替え予定）
  - 財務深掘り: EDINET DB（公式XBRLベース・毎日8時更新）を常時使用
  - IRBANKスクレイピングは廃止。EDINET取得失敗時は黙って代替せず
    dataSource='unavailable' / freshness='critical' として明示する。
"""
import sys, io, argparse, time, json, warnings
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
warnings.filterwarnings('ignore')

import requests
import pandas as pd
import yfinance as yf
from datetime import datetime, date

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

# ──────────────────────────────────────────
# プリセット定義
# ──────────────────────────────────────────
PRESETS = {
    'default':          {'roe_min': 8,  'per_min': 5, 'per_max': 30, 'pbr_min': 0.3, 'pbr_max': 5,  'div_min': 0},
    'value':            {'roe_min': 6,  'per_min': 5, 'per_max': 25, 'pbr_min': 0.3, 'pbr_max': 3,  'div_min': 1.5},
    'growth':           {'roe_min': 15, 'per_min': 10,'per_max': 50, 'pbr_min': 1.0, 'pbr_max': 15, 'div_min': 0},
    'high_dividend':    {'roe_min': 8,  'per_min': 5, 'per_max': 20, 'pbr_min': 0.3, 'pbr_max': 3,  'div_min': 4},
    'small_cap_value':  {'roe_min': 8,  'per_min': 5, 'per_max': 20, 'pbr_min': 0.3, 'pbr_max': 2,  'div_min': 2},
    'stable_defensive': {'roe_min': 6,  'per_min': 5, 'per_max': 25, 'pbr_min': 0.3, 'pbr_max': 4,  'div_min': 1.5},
}

# ──────────────────────────────────────────
# Step1: JPXマスターから対象銘柄を取得
# ──────────────────────────────────────────
def fetch_jpx_master(industry_codes: list[int]) -> pd.DataFrame:
    print(f'[1/4] JPXマスター取得中...')
    url = 'https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls'
    r = requests.get(url, headers=HEADERS, timeout=20)
    df = pd.read_excel(io.BytesIO(r.content))
    df.columns = ['date','code','name','market','sector33_code','sector33','sector17_code','sector17','scale_code','scale']
    # プライム・スタンダードのみ、ETF除外
    df = df[df['market'].isin(['プライム（内国株式）', 'スタンダード（内国株式）'])]
    df = df[df['sector33_code'].apply(lambda x: str(x).isdigit())]
    df['sector33_code'] = df['sector33_code'].astype(int)
    df = df[df['sector33_code'].isin(industry_codes)]
    df['code'] = df['code'].astype(str).str.zfill(4)
    print(f'   対象銘柄: {len(df)}社（業種コード: {industry_codes}）')
    return df[['code','name','sector33_code','sector33']].reset_index(drop=True)

# ──────────────────────────────────────────
# Step2: yfinanceで株価・指標取得
# ──────────────────────────────────────────
def fetch_yfinance(code: str) -> dict | None:
    try:
        tick = yf.Ticker(f'{code}.T')
        info = tick.info
        price = info.get('currentPrice') or info.get('regularMarketPrice')
        if not price:
            return None
        div = info.get('dividendYield', 0) or 0
        div_pct = round(div * 100 if div < 1 else div, 2)
        return {
            'price':        round(price, 0),
            'per':          round(info.get('trailingPE', 0) or 0, 2) or None,
            'pbr':          round(info.get('priceToBook', 0) or 0, 2),
            'roe':          round((info.get('returnOnEquity', 0) or 0) * 100, 2),
            'dividend':     div_pct,
            'market_cap':   round((info.get('marketCap', 0) or 0) / 1e8),
            'high_52w':     info.get('fiftyTwoWeekHigh', price),
            'low_52w':      info.get('fiftyTwoWeekLow', price),
        }
    except Exception:
        return None

# ──────────────────────────────────────────
# Step4: スコア算出
# ──────────────────────────────────────────
def calc_score(yf_data: dict, irbank: dict, preset: dict) -> int:
    score = 50  # ベーススコア

    roe = yf_data.get('roe', 0) or 0
    per = yf_data.get('per') or 15
    pbr = yf_data.get('pbr', 0) or 0
    div = yf_data.get('dividend', 0) or 0
    eq  = irbank.get('equity_ratio') or 50

    # ROEスコア（最重要）
    if roe >= 20: score += 20
    elif roe >= 15: score += 15
    elif roe >= 10: score += 10
    elif roe >= 6: score += 5

    # PERスコア（割安ほど高い）
    if 8 <= per <= 15: score += 10
    elif 15 < per <= 22: score += 5
    elif per < 8: score += 3

    # PBRスコア
    if pbr < 1.0: score += 8
    elif pbr < 2.0: score += 5
    elif pbr < 3.0: score += 2

    # 配当スコア
    if div >= 4: score += 8
    elif div >= 3: score += 5
    elif div >= 2: score += 3
    elif div >= 1.5: score += 1

    # 自己資本比率スコア
    if eq >= 70: score += 5
    elif eq >= 50: score += 3

    return min(score, 100)

# 罠検出・鮮度判定は EDINET DB ベース（edinet_fetcher.detect_trap_v2 /
# calc_freshness_edinet）に一本化した。IRBANKベースの旧ロジックは廃止。

# ──────────────────────────────────────────
# メイン
# ──────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--industries', required=True, help='業種コード（カンマ区切り）例: 5250,2050')
    parser.add_argument('--preset', default='stable_defensive', choices=PRESETS.keys())
    parser.add_argument('--top', type=int, default=15, help='最終出力件数')
    parser.add_argument('--deep', action='store_true',
                        help='（廃止・互換のため受理のみ）EDINET DB深掘りは常時有効です')
    args = parser.parse_args()

    industry_codes = [int(x) for x in args.industries.split(',')]
    preset = PRESETS[args.preset]
    print(f'\n=== 日本株スクリーニング開始 ===')
    print(f'業種コード: {industry_codes}  プリセット: {args.preset}  上位{args.top}件\n')

    # Step1: 銘柄リスト取得
    master = fetch_jpx_master(industry_codes)

    # Step2: yfinanceでスクリーニング
    print(f'[2/4] yfinanceで{len(master)}社をスクリーニング中...')
    candidates = []
    for _, row in master.iterrows():
        code = row['code']
        yf_data = fetch_yfinance(code)
        if not yf_data:
            continue
        p = yf_data
        # プリセットフィルタ
        if p['roe'] < preset['roe_min']: continue
        per = p['per']
        if per and (per < preset['per_min'] or per > preset['per_max']): continue
        if p['pbr'] < preset['pbr_min'] or p['pbr'] > preset['pbr_max']: continue
        if p['dividend'] < preset['div_min']: continue
        # 株価レンジ（1500〜4000円）
        if p['price'] < 1000 or p['price'] > 6000: continue
        score = calc_score(p, {}, preset)
        candidates.append({
            'code': code, 'name': row['name'],
            'industryCode': str(row['sector33_code']),
            'industry': row['sector33'],
            **p, 'score': score
        })
        sys.stdout.write(f'  ✓ {code} {row["name"][:10]} ROE:{p["roe"]}% score:{score}\n')
        sys.stdout.flush()
        time.sleep(0.3)

    candidates.sort(key=lambda x: x['score'], reverse=True)
    top40 = candidates[:40]
    print(f'\n   1段階目通過: {len(top40)}社（元{len(candidates)}社）')

    # Step3: 深掘り（EDINET DB に一本化・IRBANK廃止）
    # 取得失敗時は黙って代替せず dataSource='unavailable' として明示する（鮮度保証方針）
    print(f'\n[3/4] EDINET DB で財務深掘り中（公式XBRL・毎日8時更新）...')
    from edinet_fetcher import EDINETClient, extract_metrics, detect_trap_v2, calc_freshness_edinet
    edinet = EDINETClient()
    code_map = edinet.build_code_map()
    edinet_count = unavailable_count = 0
    rate_limited = False

    results = []
    for s in top40:
        if s['score'] < 60:
            # スコア閾値未満は深掘り対象外。財務未取得を明示
            results.append({**s, 'deepScore': s['score'],
                            'trapFlag': 'normal', 'trapReasons': [],
                            'freshness': 'critical', 'irbankDate': None,
                            'equityRatio': 50, 'consecutiveDividendYears': 0,
                            'dataSource': 'unavailable'})
            continue

        # ── EDINET DB ──────────────────────────────
        company = None
        if not rate_limited:
            try:
                company = edinet.fetch_company(s['code'], code_map)
            except RuntimeError as e:
                print(f'  ⚠ EDINET DB レート制限到達: {e}')
                print('  以降の銘柄は dataSource=unavailable として記録します（IRBANK代替は行いません）')
                rate_limited = True

        if company:
            metrics = extract_metrics(company)
            trap_flag, trap_reasons, penalty = detect_trap_v2(metrics)
            deep_score  = min(100, max(0, s['score'] + penalty))
            freshness   = calc_freshness_edinet(metrics.get('disclosure_date'))
            eq_ratio    = metrics.get('equity_ratio', 50) or 50
            disc_date   = metrics.get('disclosure_date') or date.today().isoformat()
            edinet_count += 1

            status = '⚠' if trap_flag != 'normal' else '✓'
            print(f'  {status} {s["code"]} {s["name"][:10]} '
                  f'score:{s["score"]}→{deep_score} [{trap_flag}] [EDINET DB]')
            results.append({
                **s,
                'deepScore': deep_score,
                'trapFlag': trap_flag,
                'trapReasons': trap_reasons,
                'freshness': freshness,
                'irbankDate': disc_date,
                'equityRatio': eq_ratio,
                'consecutiveDividendYears': 0,
                'dataSource': 'edinet_db',
            })
            continue

        # ── 取得失敗 → 明示（黙ってスクレイピング代替しない）──────
        unavailable_count += 1
        print(f'  ✗ {s["code"]} {s["name"][:10]} EDINET DB 未取得 → dataSource=unavailable（要確認）')
        results.append({
            **s,
            'deepScore': s['score'],          # 罠検出できないのでペナルティ0（素点のまま）
            'trapFlag': 'normal',
            'trapReasons': ['財務データ未取得（EDINET DB未収録/失敗）'],
            'freshness': 'critical',          # 鮮度保証できない＝critical扱い
            'irbankDate': None,
            'equityRatio': 50,
            'consecutiveDividendYears': 0,
            'dataSource': 'unavailable',
        })

    print(f'\n  データソース: EDINET DB {edinet_count}社 / 未取得(unavailable) {unavailable_count}社')
    print(f'  リクエスト消費: {edinet.request_count}回（残り {100 - edinet.request_count}回）')
    if unavailable_count:
        print(f'  ⚠ {unavailable_count}社が財務未取得です。鮮度を保証できないため critical で記録しました。')

    # deepScore降順でrank付与
    results.sort(key=lambda x: x['deepScore'], reverse=True)
    for i, r in enumerate(results):
        r['rank'] = i + 1

    final = results[:args.top]
    print(f'\n[4/4] 完了: 上位{len(final)}社を出力')

    # JSON形式で出力（update_data.pyが読み込む）
    output_path = 'scripts/screening_result.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final, f, ensure_ascii=False, indent=2)
    print(f'\n結果を {output_path} に保存しました。')
    print('次に: python scripts/update_data.py を実行してダッシュボードに反映してください。')

    # サマリー表示
    print('\n=== スクリーニング結果サマリー ===')
    dangerous  = sum(1 for r in final if r['trapFlag'] == 'dangerous')
    suspicious = sum(1 for r in final if r['trapFlag'] == 'suspicious')
    normal     = sum(1 for r in final if r['trapFlag'] == 'normal')
    print(f'罠検出: dangerous={dangerous} suspicious={suspicious} normal={normal}')
    print(f'\n順位  コード  銘柄名              deepScore  trap')
    for r in final:
        name = r['name'][:12].ljust(14)
        print(f"{r['rank']:3}  {r['code']}  {name}  {r['deepScore']:3}  {r['trapFlag']}")

if __name__ == '__main__':
    main()
