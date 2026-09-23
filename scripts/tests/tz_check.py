"""タイムゾーン周りの OS 依存チェック（Windows / macOS / Linux で同じものを走らせる）

使い方: python scripts/tests/tz_check.py

なぜ必要か:
  Windows には OS のタイムゾーンDBが無いため `ZoneInfo('Asia/Tokyo')` が失敗する。
  これを黙って None にすると呼び出し側が date.today() にフォールバックし、
  BUG-012（前営業日の終値に当日の日付が付く）が警告なしに復活する。
  東証は夏時間が無く通年 UTC+9 なので固定オフセットで代替できる（近似ではなく正確な値）が、
  「本当に同じ日付になるか」は実機で確かめないと分からない。

ネットワークにも EDINET の APIキーにも依存しない。固定のタイムスタンプで判定する。
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Windows の Python は標準出力が cp1252 のため、日本語を print するだけで
# UnicodeEncodeError で落ちる（GitHub Actions の windows-latest で実際に発生）。
# 既存のスクリプトと同じく reconfigure で UTF-8 にしておく。
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, 'scripts')

failures = 0


def check(name, ok, detail=''):
    global failures
    print(f"{'✓' if ok else '✗'} {name}" + (f'  … {detail}' if detail else ''))
    if not ok:
        failures += 1


JST = timezone(timedelta(hours=9))


def epoch(y, mo, d, h, mi):
    """JST の日時を epoch 秒に変換（tzdata に依存しない）"""
    return int(datetime(y, mo, d, h, mi, tzinfo=JST).timestamp())


print(f'\n=== 実行環境: {sys.platform} / Python {sys.version.split()[0]} ===\n')

import fetch_stocks as fs  # noqa: E402

# ── ① tzdata がある通常経路 ─────────────────────────────
tz = fs._exchange_tz('Asia/Tokyo')
check('Asia/Tokyo が解決できる（tzdata 有無どちらでも）', tz is not None)
if tz is not None:
    off = datetime(2026, 9, 23, 12, 0, tzinfo=tz).utcoffset()
    check('東証のオフセットが +09:00', off == timedelta(hours=9), str(off))

# ── ② 場中の終値 → その日の日付になるか ──────────────────
info = {'regularMarketTime': epoch(2026, 9, 18, 15, 0), 'exchangeTimezoneName': 'Asia/Tokyo'}
check('場中(15:00 JST)の約定が当日の日付になる',
      fs.quote_date(info) == '2026-09-18', fs.quote_date(info))

# ── ③ UTC 日付とズレる時刻でも JST 基準になるか ────────────
#   2026-09-19 08:30 JST = 2026-09-18 23:30 UTC。
#   UTC で判定していると 1 日ずれる（BUG-012 と同じ種類の誤り）。
info2 = {'regularMarketTime': epoch(2026, 9, 19, 8, 30), 'exchangeTimezoneName': 'Asia/Tokyo'}
check('UTC と日付が異なる時刻でも JST 基準の日付になる',
      fs.quote_date(info2) == '2026-09-19', fs.quote_date(info2))

# ── ④ tzdata が無い状況を強制して同じ結果になるか ───────────
#   Windows で tzdata を入れ忘れた状態の再現。
#   ここで日付が変わったり None になったら、鮮度表示が静かに壊れている。
expected = fs.quote_date(info)
orig = fs.ZoneInfo


def always_fail(_name):
    raise Exception('tzdata が無い状況の再現')


fs.ZoneInfo = always_fail
fs._tz_warned = False
print('  --- ZoneInfo を必ず失敗させた状態 ---')
fallback = fs.quote_date(info)
fs.ZoneInfo = orig

check('tzdata が無くても同じ日付になる（固定オフセットで代替）',
      fallback == expected, f'通常={expected} / 代替={fallback}')
check('代替時も None を返さない（date.today() へ黙って落ちない）', fallback is not None)

# ── ⑤ 代替できない取引所は None を返し、警告を出すか ─────────
fs.ZoneInfo = always_fail
fs._tz_warned = False
info_ny = {'regularMarketTime': epoch(2026, 9, 18, 15, 0), 'exchangeTimezoneName': 'America/New_York'}
ny = fs.quote_date(info_ny)
fs.ZoneInfo = orig
check('夏時間のある取引所は代替せず None を返す', ny is None, str(ny))

# ── ⑥ 全スクリプトが標準出力を UTF-8 にしているか ─────────
#   Windows の既定は cp1252 で、日本語を print した瞬間に UnicodeEncodeError で落ちる。
#   このプロジェクトのログは全て日本語なので、1行でも print すれば影響する。
#   実際に windows-latest でこのスクリプト自身が落ちたため、抜けを機械的に検出する。
missing = [
    str(f) for f in sorted(Path('scripts').rglob('*.py'))
    if 'reconfigure(encoding' not in f.read_text(encoding='utf-8')
    and '__pycache__' not in str(f)
]
check('全 Python スクリプトが標準出力を UTF-8 に設定している',
      not missing, '未対応: ' + ', '.join(missing) if missing else '')

print(f"\n=== {'すべて通過' if failures == 0 else f'{failures} 件失敗'} ===")
sys.exit(0 if failures == 0 else 1)
