"""
EDINET DB APIクライアント
- 証券コード → EDINETコード変換マップ構築
- 財務時系列・TDNet決算短信の取得（キャッシュ付き）
- 罠検出・スコア計算用メトリクス抽出
使い方: python scripts/edinet_fetcher.py --test 3635,3626,6036
"""
import sys, io, json, requests, argparse
from pathlib import Path
from datetime import datetime, timedelta, date

# 出力を UTF-8 にする。新しい TextIOWrapper を被せると、
# 別スクリプトから import されたとき前のラッパーが破棄されて
# 元の buffer ごと閉じられてしまうため、reconfigure で既存の stdout を設定し直す。
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "https://edinetdb.jp/v1"
CACHE_DIR = Path("scripts/cache/edinet")


def _load_api_key() -> str:
    env_path = Path(".env.local")
    if not env_path.exists():
        raise FileNotFoundError(".env.local が見つかりません")
    for line in env_path.read_text(encoding='utf-8').splitlines():
        if line.startswith("EDINET_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise ValueError("EDINET_API_KEY が .env.local に見つかりません")


class EDINETClient:
    def __init__(self):
        self.api_key = _load_api_key()
        self.request_count = 0
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _headers(self) -> dict:
        return {"X-API-Key": self.api_key}

    def _cache_path(self, subdir: str, key: str) -> Path:
        p = CACHE_DIR / subdir
        p.mkdir(parents=True, exist_ok=True)
        return p / f"{key}.json"

    def _load_cache(self, subdir: str, key: str, ttl_hours: int):
        path = self._cache_path(subdir, key)
        if not path.exists():
            return None
        age = datetime.now() - datetime.fromtimestamp(path.stat().st_mtime)
        if age > timedelta(hours=ttl_hours):
            return None
        return json.loads(path.read_text(encoding='utf-8'))

    def _save_cache(self, subdir: str, key: str, data) -> None:
        path = self._cache_path(subdir, key)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

    def _get(self, endpoint: str, params: dict = None, ttl_hours: int = 24) -> dict:
        cache_key = endpoint.replace("/", "_").strip("_")
        if params:
            cache_key += "__" + "__".join(f"{k}_{v}" for k, v in sorted(params.items()))

        cached = self._load_cache("raw", cache_key, ttl_hours)
        if cached is not None:
            return cached

        r = requests.get(
            f"{BASE_URL}{endpoint}",
            headers=self._headers(),
            params=params or {},
            timeout=15,
        )
        if r.status_code == 429:
            raise RuntimeError("EDINET DB レート制限に到達（100回/日）")
        r.raise_for_status()
        data = r.json()
        self.request_count += 1
        self._save_cache("raw", cache_key, data)
        return data

    # ──────────────────────────────────────────
    # 証券コード → EDINETコード 変換マップ
    # ──────────────────────────────────────────
    def build_code_map(self) -> dict[str, dict]:
        """
        sec_code(4桁) → {edinet_code, name_ja, accounting_standard} の辞書を返す。
        30日キャッシュ。初回のみAPIリクエスト1回消費。
        """
        cache_path = CACHE_DIR / "code_map.json"
        if cache_path.exists():
            age = datetime.now() - datetime.fromtimestamp(cache_path.stat().st_mtime)
            if age < timedelta(days=30):
                return json.loads(cache_path.read_text(encoding='utf-8'))

        print("[EDINET] 企業マスター取得中（月1更新・1リクエスト消費）...")
        data = self._get("/companies", {"per_page": 5000}, ttl_hours=720)
        companies = data.get("data", [])

        code_map: dict[str, dict] = {}
        for c in companies:
            sec = str(c.get("sec_code", "") or "").strip()
            # EDINET DB の sec_code は末尾0付き5桁のことがある（例: 36260 → 3626）
            if len(sec) == 5 and sec.endswith("0"):
                sec = sec[:4]
            if sec and c.get("edinet_code"):
                code_map[sec] = {
                    "edinet_code": c["edinet_code"],
                    "name_ja": c.get("name_ja", ""),
                    "accounting_standard": c.get("accounting_standard", "JP"),
                }

        cache_path.write_text(json.dumps(code_map, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"[EDINET] 変換マップ作成完了: {len(code_map)}社")
        return code_map

    # ──────────────────────────────────────────
    # 1社分データ取得（2リクエスト/社、キャッシュ有効時は0）
    # ──────────────────────────────────────────
    def fetch_company(self, sec_code: str, code_map: dict) -> dict | None:
        """
        financials（7日キャッシュ）+ earnings（24時間キャッシュ）を取得して返す。
        EDINETコード不明・取得失敗時は None を返す。
        """
        entry = code_map.get(sec_code)
        if not entry:
            return None

        edinet_code = entry["edinet_code"]
        try:
            fin  = self._get(f"/companies/{edinet_code}/financials", ttl_hours=168)
            earn = self._get(f"/companies/{edinet_code}/earnings",   ttl_hours=24)
            return {
                "edinet_code": edinet_code,
                "accounting_standard": entry.get("accounting_standard", "JP"),
                "financials": fin.get("data", []),
                "earnings":   earn.get("data", {}).get("earnings", []),
            }
        except RuntimeError:
            raise  # レート制限はそのまま上げる
        except Exception:
            return None


# ──────────────────────────────────────────
# メトリクス抽出（スコア・罠検出の共通入力）
# ──────────────────────────────────────────
def extract_metrics(company: dict) -> dict:
    """
    EDINETデータから罠検出・スコア計算に使う指標を抽出する。
    equity_ratio_official が 0〜1 の小数で返ってくる場合は % に変換。
    """
    financials = company.get("financials", [])
    earnings   = company.get("earnings", [])
    acct_std   = company.get("accounting_standard", "JP")

    if not financials:
        return {}

    recent_5y = financials[-5:] if len(financials) >= 5 else financials
    latest    = financials[-1]

    def to_pct(v) -> float:
        """0.xx 形式 → % 変換（絶対値が1以下なら×100）"""
        if v is None:
            return 0.0
        fv = float(v)
        return fv * 100 if abs(fv) <= 1.0 else fv

    roe_5y = [to_pct(f.get("roe_official"))   for f in recent_5y]
    oi_5y  = [float(f.get("ordinary_income") or 0) for f in recent_5y]
    ni_5y  = [float(f.get("net_income")      or 0) for f in recent_5y]
    eps_5y = [float(f.get("eps")             or 0) for f in recent_5y]
    rev_5y = [float(f.get("revenue")         or 0) for f in recent_5y]
    eq_ratio = to_pct(latest.get("equity_ratio_official"))

    # TDNet開示日：earnings にあればそちらを使用、なければ決算期末から推定
    disclosure_date = None
    if earnings:
        disclosure_date = earnings[0].get("disclosure_date")
    if not disclosure_date and latest.get("fiscal_year"):
        # 3月末決算が多いため5月開示を仮定（精度は落ちるが鮮度判定に使用）
        disclosure_date = f"{int(latest['fiscal_year'])}-05-15"

    return {
        "roe_5y":              roe_5y,
        "oi_5y":               oi_5y,
        "ni_5y":               ni_5y,
        "eps_5y":              eps_5y,
        "rev_5y":              rev_5y,
        "equity_ratio":        eq_ratio,
        "disclosure_date":     disclosure_date,
        "accounting_standard": acct_std,
        "latest_oi":           oi_5y[-1]  if oi_5y  else 0,
        "latest_ni":           ni_5y[-1]  if ni_5y  else 0,
        "latest_roe":          roe_5y[-1] if roe_5y else 0,
        "fiscal_year":         latest.get("fiscal_year"),
    }


# ──────────────────────────────────────────
# 財務詳細の抽出（ダッシュボードの edinetDetails 用）
# ──────────────────────────────────────────
def extract_detail(company: dict) -> dict:
    """
    EDINETデータから src/types.ts の EdinetDetail 相当の値を抽出する。

    単位の扱い（実データで検証済み）:
      - financials（有報）の revenue / net_income 等は「円」→ 1e8 で割って億円にする
      - financials の equity_ratio_official / roe_official は 0〜1 の小数 → ×100 で %
      - earnings（決算短信）の金額は「百万円」（eps×株数と一致することを確認）
      - earnings の equity_ratio は既に % 表記
    """
    financials = company.get("financials", [])
    earnings = company.get("earnings", [])
    if not financials:
        return {}

    latest = financials[-1]

    def oku(v):
        """円 → 億円（小数1桁）"""
        if v is None:
            return None
        return round(float(v) / 1e8, 1)

    def pct(v):
        """0〜1の小数なら % に変換"""
        if v is None:
            return None
        fv = float(v)
        return round(fv * 100 if abs(fv) <= 1.0 else fv, 1)

    detail = {
        "fiscalYear": latest.get("fiscal_year"),
        "annualEquityRatio": pct(latest.get("equity_ratio_official")),
        "annualROE": pct(latest.get("roe_official")),
        "annualNetIncome": oku(latest.get("net_income")),
        "annualOrdinaryIncome": oku(latest.get("ordinary_income")),
        "annualRevenue": oku(latest.get("revenue")),
        # 直近決算短信。EDINET DB は直近30日ウィンドウのため取れないことがある。
        # その場合は黙って埋めず null のままにする（鮮度保証の方針）。
        "latestQuarter": None,
        "latestDisclosureDate": None,
        "latestEquityRatio": None,
        "latestNetIncome": None,
        "latestNetIncomeChange": None,
        "forecastNetIncome": None,
        "forecastNetIncomeChange": None,
    }

    if earnings:
        e = earnings[0]
        d = parse_date(e.get("disclosure_date"))
        detail.update({
            "latestQuarter": e.get("quarter"),
            "latestDisclosureDate": d.isoformat() if d else None,
            "latestEquityRatio": e.get("equity_ratio"),
            "latestNetIncome": e.get("net_income"),
            "latestNetIncomeChange": e.get("net_income_change"),
            "forecastNetIncome": e.get("forecast_net_income"),
            "forecastNetIncomeChange": e.get("forecast_net_income_change"),
        })

    return detail


# ──────────────────────────────────────────
# 罠検出 v2（EDINET DB 強化版・5ルール）
# ──────────────────────────────────────────
def detect_trap_v2(metrics: dict) -> tuple[str, list[str], int]:
    """
    Returns: (flag, reasons, score_delta)
      flag: 'normal' / 'suspicious' / 'dangerous'
      score_delta: +3（健全）/ -15（suspicious）/ -30（dangerous）
    """
    if not metrics:
        return "normal", [], 0

    reasons = []
    roe_5y = metrics.get("roe_5y", [])
    eps_5y = metrics.get("eps_5y", [])
    oi_5y  = metrics.get("oi_5y",  [])
    ni_5y  = metrics.get("ni_5y",  [])
    eq     = metrics.get("equity_ratio", 50)
    acct   = metrics.get("accounting_standard", "JP")
    oi     = metrics.get("latest_oi", 0)
    ni     = metrics.get("latest_ni", 0)

    # ルール1: ROE急騰（直近 > 過去平均 × 2.0）
    if len(roe_5y) >= 4:
        past = [v for v in roe_5y[:-1] if v > 0]
        if past:
            avg = sum(past) / len(past)
            if roe_5y[-1] > avg * 2.0:
                reasons.append(f"ROE急騰({avg:.1f}%→{roe_5y[-1]:.1f}%)")

    # ルール2: EPS急騰（直近 > 過去平均 × 2.5）
    if len(eps_5y) >= 4:
        past = [v for v in eps_5y[:-1] if v > 0]
        if past:
            avg = sum(past) / len(past)
            if eps_5y[-1] > avg * 2.5:
                reasons.append(f"EPS急騰({avg:.1f}→{eps_5y[-1]:.1f})")

    # ルール3: 純利益 >> 経常利益（JP GAAP のみ・特別利益疑い）
    # JP GAAP の正常値: 純利益 ≈ 経常利益 × 0.65〜0.75（実効税率30%）
    # 純利益 > 経常利益 × 0.9 なら特別利益が上乗せされている可能性
    if acct == "JP" and oi and oi > 0 and ni > oi * 0.9:
        reasons.append(
            f"純利益({ni/1e8:.1f}億)>経常利益×0.9（特益疑い）"
        )

    # ルール4: 赤字急回復（過去3年に赤字期あり & 直近黒字）
    if len(oi_5y) >= 3 and oi_5y[-1] > 0:
        if any(v < 0 for v in oi_5y[:-1]):
            reasons.append("赤字急回復")

    # ルール5: 自己資本比率低水準
    if 0 < eq < 40:
        reasons.append(f"自己資本比率{eq:.1f}%（低水準）")

    if len(reasons) >= 2:
        return "dangerous", reasons, -30
    elif len(reasons) == 1:
        return "suspicious", reasons, -15
    else:
        bonus = 3 if eq >= 60 else 0
        return "normal", [], bonus


# ──────────────────────────────────────────
# 6項目評価（100点満点）
# ──────────────────────────────────────────
# 現在データを取得できているのは4項目・65点ぶん。
# 残る2項目は算出根拠が無いため None を返し、画面に「未算出」と表示させる。
# 取得できていないものを中立値などで埋めると、評価が成立していないことが見えなくなる。
#
#   ① カタリスト   /20 … 決算発表予定日の取得手段が無いため未算出
#   ② モメンタム   /20 … EDINET の年次推移から算出
#   ③ 需給・テクニカル /15 … 信用倍率・出来高を取得していないため未算出
#   ④ バリュエーション /15 … PER・PBR から算出
#   ⑤ 下値リスク   /15 … 自己資本比率から算出
#   ⑥ 配当         /15 … 配当利回りから算出（連続増配ぶん3点は未取得のため最大12）

SCORE_MAX = {
    "catalyst": 20, "momentum": 20, "supply": 15,
    "valuation": 15, "downside": 15, "dividend": 15,
}


def _yoy(series: list[float]) -> float | None:
    """直近と前期の変化率(%)。前期が0以下なら比較不能として None を返す。"""
    if len(series) < 2:
        return None
    prev, latest = series[-2], series[-1]
    if prev <= 0:
        return None
    return (latest - prev) / prev * 100


def _band(value, table, default=0):
    """(閾値, 点数) のリストを上から評価して点数を返す。"""
    if value is None:
        return default
    for threshold, points in table:
        if value >= threshold:
            return points
    return default


def calc_score_breakdown(metrics: dict, yf_data: dict) -> dict:
    """6項目評価を算出する。算出できない項目は None。"""
    # ② モメンタム /20 … 純利益10 + 経常利益6 + 売上4
    ni_yoy = _yoy(metrics.get("ni_5y", []))
    oi_yoy = _yoy(metrics.get("oi_5y", []))
    rev_yoy = _yoy(metrics.get("rev_5y", []))
    if ni_yoy is None and oi_yoy is None and rev_yoy is None:
        momentum = None
    else:
        momentum = (
            _band(ni_yoy,  [(30, 10), (15, 8), (5, 6), (0.01, 3)])
            + _band(oi_yoy, [(30, 6), (15, 5), (5, 3), (0.01, 2)])
            + _band(rev_yoy, [(10, 4), (5, 3), (0.01, 2)])
        )

    # ④ バリュエーション /15 … PER8 + PBR7
    # PER が取れない銘柄は「割安と判断できない」ため加点しない（0点）
    per = yf_data.get("per")
    pbr = yf_data.get("pbr") or 0
    per_pts = 0
    if per is not None:
        if 8 <= per <= 15:   per_pts = 8
        elif per < 8:        per_pts = 6
        elif per <= 20:      per_pts = 6
        elif per <= 25:      per_pts = 4
        else:                per_pts = 2
    if pbr <= 0:      pbr_pts = 0
    elif pbr < 1.0:   pbr_pts = 7
    elif pbr < 1.5:   pbr_pts = 6
    elif pbr < 2.0:   pbr_pts = 5
    elif pbr < 3.0:   pbr_pts = 3
    else:             pbr_pts = 1
    valuation = per_pts + pbr_pts

    # ⑤ 下値リスク /15 … 自己資本比率
    eq = metrics.get("equity_ratio")
    downside = _band(eq, [(70, 15), (60, 13), (50, 11), (40, 8), (30, 5)], default=2) \
        if eq else None

    # ⑥ 配当 /15 … 利回りのみ（連続増配年数は未取得のため最大12点）
    div = yf_data.get("dividend")
    dividend = _band(div, [(5, 12), (4, 11), (3, 9), (2, 6), (1, 3)]) if div is not None else None

    return {
        "catalyst":  None,       # 決算発表予定日を取得していない
        "momentum":  momentum,
        "supply":    None,       # 信用倍率・出来高を取得していない
        "valuation": valuation,
        "downside":  downside,
        "dividend":  dividend,
    }


# ──────────────────────────────────────────
# 鮮度計算（TDNet開示日ベース）
# ──────────────────────────────────────────
def parse_date(s: str) -> date | None:
    """ISO形式・HTTP日付形式など複数のフォーマットを解析してdateを返す"""
    if not s:
        return None
    # ISO形式
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        pass
    # HTTP日付形式: "Fri, 13 Feb 2026 00:00:00 GMT"
    for fmt in ('%a, %d %b %Y %H:%M:%S %Z', '%a, %d %b %Y %H:%M:%S GMT'):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            pass
    return None


def calc_freshness_edinet(disclosure_date: str | None) -> str:
    if not disclosure_date:
        return "critical"
    parsed = parse_date(disclosure_date)
    if not parsed:
        return "critical"
    days = (date.today() - parsed).days
    if days <= 30:   return "fresh"
    elif days <= 60: return "normal"
    elif days <= 90: return "stale"
    else:            return "critical"


# ──────────────────────────────────────────
# テスト実行（python scripts/edinet_fetcher.py --test 3635,3626）
# ──────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", default="3626,3635,6036,4506,9616",
                        help="テスト証券コード（カンマ区切り）")
    args = parser.parse_args()

    client   = EDINETClient()
    code_map = client.build_code_map()

    codes = [c.strip() for c in args.test.split(",")]
    print(f"\n=== EDINET DB 接続テスト ({len(codes)}社) ===")
    for code in codes:
        entry   = code_map.get(code)
        company = client.fetch_company(code, code_map)
        if not company:
            print(f"  ✗ {code}: EDINETコード不明またはデータ取得失敗")
            continue

        metrics                    = extract_metrics(company)
        trap_flag, reasons, delta  = detect_trap_v2(metrics)
        freshness                  = calc_freshness_edinet(metrics.get("disclosure_date"))
        status                     = "⚠" if trap_flag != "normal" else "✓"
        name                       = (entry or {}).get("name_ja", "")[:14]

        print(
            f"  {status} {code} {name:<16} trap={trap_flag:<10} "
            f"eq={metrics.get('equity_ratio', 0):>5.1f}%  "
            f"roe={metrics.get('latest_roe', 0):>5.1f}%  "
            f"freshness={freshness}  fy={metrics.get('fiscal_year')}"
        )
        for r in reasons:
            print(f"      └ {r}")

    print(f"\nリクエスト消費: {client.request_count}回（キャッシュ済みは0カウント）")
