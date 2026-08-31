# 作業進捗・引き継ぎメモ

| 項目 | 内容 |
|---|---|
| 最終更新 | 2026-06-10 |
| プロジェクト | 日本株分析ダッシュボード → 「使える投資AI」化 |
| 最優先方針 | **データ鮮度の保証**（古い値を黙って残さない） |
| 作業ディレクトリ | `~/OneDrive/Desktop/システム開発/20260610_AI投資` |

---

## ✅ 2026-06-10 に完了したこと

### 1a. IRBANK廃止 → EDINET DB一本化（鮮度劣化の主因を排除）
- `scripts/fetch_stocks.py`：IRBANKスクレイピング関連を全削除。財務深掘りをEDINET DBに常時一本化。
- 取得失敗時は黙って代替せず `dataSource='unavailable'` / `freshness='critical'` で**明示**する設計。

### 1b. 鮮度バナー（鮮度の見える化）
- `src/FreshnessBanner.tsx`（新規）＋ `src/App.tsx`。ヘッダーに最終更新日・経過日数・要更新警告（🔴refresh推奨）・財務未取得件数を表示。
- `≤7日`=✅最新 / `≤30日`=⚠️やや古い / `>30日`=🔴要更新。

### 1c. マクロ→業種の自動絞り込み接続＋可視化
- `vite-plugin-macro.ts`：Claude出力スキーマに `targetSectors`/`avoidSectors` 追加（JPX33業種コード表内蔵・バリデーション・data.ts書き戻し）。
- `src/data.ts`：`generatedCommand` を `targetSectors` から自動生成（`--industries` が自動追従）。
- `src/MacroView.tsx`：「🎯 現在スクリーニングで絞り込む業種」チップを追加。

### 検証済み
- `npx vite build` 成功（35 modules）。書き戻し正規表現マッチ確認済み。
- 仕様書更新：`docs/specs/data_sources.md`, `docs/specs/ui/macro.md`。

---

## 🎯 確定した方針（データソース）

**A案（月¥1,650・定額）採用**。詳細は `docs/specs/data_sources.md`。
- L1 株価/指標: **J-Quants Light**（公式JPX・T+1・定額¥1,650/月）＋ yfinance補助
- L2 決算詳細: **EDINET DB**（無料・毎日8時更新）＋ EDINET公式backstop
- IRBANK廃止済み。

J-Quants：株価＋決算"数値"（売上/利益/自己資本/会社予想/配当・5年分）を公式取得。
EDINET DB：特益内訳・セグメント・事業内容テキスト・大株主など"数値で表せない定性"を無料で補完。

---

## ⏭ 次回やること（J-Quants登録が前提）

> **ユーザー対応待ち**：https://jpx-jquants.com/ で登録＋Lightプラン契約 → メール/パスワードを
> `.env.local` に `JQUANTS_MAIL=` / `JQUANTS_PASSWORD=` で設定（または口頭で共有）。

1. **`scripts/jquants_fetcher.py`（新規）** — J-Quants認証（メール/パス→refreshToken→idToken）→ 株価・指標・財務を取得。
2. **`scripts/fetch_stocks.py` 改修** — 母集団・株価・指標をyfinance主軸からJ-Quants主軸へ（yfinanceは補助/即時参考）。
3. **`scripts/refresh.py`（新規）** — 「J-Quants＋EDINET DB取得 → data.ts全反映 → 鮮度サマリ表示」を一発化。これを実行すると鮮度バナーが🔴→✅になる。
4. **深掘り強化** — 決算発表予定日（カタリスト）・信用需給・通期進捗率を自動取得して6項目評価に反映。

### 任意の追加候補
- マクロのスクレイピング（`fetch_macro.py`）失敗を鮮度バナーで警告（IRBANKと同じ「黙って劣化」リスクが残っているため）。

---

## メモ：すぐ動かす方法
```
cd ~/OneDrive/Desktop/システム開発/20260610_AI投資
npm run dev      # IRBANK廃止済み＋鮮度バナー＋業種自動絞り込みの状態で起動
```
現状 data.ts は 2026-04-21 取得のサンプルのままなので、鮮度バナーは「🔴要更新」を表示する（＝正しく古さを警告）。refresh.py 実装＆実行で最新化される。
