# 機能仕様書 — 日本株分析ダッシュボード

| 項目 | 内容 |
|---|---|
| 対象ファイル | src/App.tsx, src/MacroView.tsx, src/ScreeningView.tsx, src/DeepDiveView.tsx, src/PortfolioView.tsx |
| 依存データ | src/data.ts, src/types.ts |
| 作成日 | 2026-04-15 |
| 最終更新 | 2026-04-15 |

---

## 1. 機能概要

日本株の銘柄選定・分析・ポートフォリオ管理を3ステップで進める単一ページアプリケーション（SPA）。  
Claude + pipeline.py による2段階スクリーニング結果をビジュアル化し、投資判断を支援する。

---

## 2. 技術スタック

| 区分 | 採用技術 | 選定理由 |
|---|---|---|
| UIフレームワーク | React 19 + TypeScript | コンポーネント再利用性・型安全性 |
| スタイリング | Tailwind CSS v4 | 高速プロトタイピング・ユーティリティベース |
| ビルドツール | Vite 6 | 高速HMR・軽量バンドル |
| データ管理 | src/data.ts（静的モックデータ） | バックエンド不要のシンプル構成 |
| 外部チャートライブラリ | 不使用 | CSSバーで代替（依存削減） |

---

## 3. アプリケーション構造

```
App.tsx
├── Header（固定ヘッダー）
├── SampleDataBanner（サンプルデータ表示中バナー）
├── TabNavigation（タブ切り替え）
│   ├── ステップ1：マクロ分析 → MacroView
│   ├── ステップ2：スクリーニング → ScreeningView
│   ├── ステップ3：深掘り分析 → DeepDiveView
│   └── 最終：ポートフォリオ → PortfolioView
└── Footer（免責事項）
```

### 状態管理

| 状態 | 型 | 管理場所 | 説明 |
|---|---|---|---|
| activeTab | Tab | App.tsx | 現在表示中のタブ |
| sortKey | SortKey | ScreeningView | スクリーニングテーブルのソートキー |
| sortAsc | boolean | ScreeningView | ソート昇順/降順 |
| filterTrap | TrapFlag \| 'all' | ScreeningView | 罠フラグフィルタ |
| expandedIdx | number \| null | DeepDiveView | 展開中の銘柄カードインデックス |
| copied | boolean | MacroView | コピー完了フィードバック状態 |

---

## 4. データフロー

```
src/data.ts（静的データ）
    ├─ economistReports → MacroView（3エコノミストカード）
    ├─ targetSectors    → MacroView（狙うセクター）
    ├─ avoidSectors     → MacroView（避けるセクター）
    ├─ screeningCommandArgs → MacroView（実行コマンドの引数部分。Python の実行コマンド名は
    │                        GET /api/env から取得して付与する。BUG-019 参照）
    ├─ screeningStocks  → ScreeningView（テーブル）/ DeepDiveView（銘柄カード）
    ├─ edinetDetails    → PortfolioView（財務一覧）/ 一次資料リンク
    ├─ pipelineMeta     → 鮮度バナー（株価・財務）・サマリーカード
    ├─ macroMeta        → 鮮度バナー（マクロ）・MacroView
    └─ portfolioPositions → PortfolioView（ポジション一覧・現在は空）
```

---

## 5. 処理フロー

### 5.1 スクリーニング結果のソート処理（ScreeningView）

```
1. screeningStocks をコピー
2. filterTrap でフィルタ（'all' の場合はスキップ）
3. sortKey で並び替え
   - 'per' の場合は null を 999 として扱い末尾に寄せる
   - sortAsc が true なら昇順、false なら降順
4. テーブルに描画
```

### 5.2 ランキング付番ルール（data.ts）

```
rank = deepScore 降順での順位
（1段階目スコアではなく、IRBANK罠検出後のdeepScoreを基準とする）

deepScore = score（1段階目）
    + 罠ペナルティ（suspicious: -15、dangerous: -30）
    + 加点（自己資本・連続増配: +0〜+8）
```

### 5.3 含み損益計算（PortfolioView）

```
各ポジション:
  pnl = (currentPrice - buyPrice) × shares
  pct = (currentPrice - buyPrice) / buyPrice × 100

合計:
  totalCost  = Σ (buyPrice × shares)  ※ cash除く
  totalValue = Σ (currentPrice × shares)  ※ cash除く
  totalPnL   = totalValue - totalCost
  pnlPct     = totalPnL / totalCost × 100
```

---

## 6. 型定義（src/types.ts）

| 型名 | 説明 |
|---|---|
| TrapFlag | `'normal' \| 'suspicious' \| 'dangerous'` |
| FreshnessTag | `'fresh' \| 'normal' \| 'stale' \| 'critical'` |
| WeatherType | `'晴れ' \| '曇り' \| '嵐'` |
| Tab | `'macro' \| 'screening' \| 'deepdive' \| 'portfolio'` |
| Stock | スクリーニング結果の銘柄データ（鮮度タグは持たない。BUG-013） |
| ScoreBreakdown | 6項目スコアの内訳 |
| EconomistReport | エコノミストレポートデータ |
| TargetSector | 狙うセクターデータ |
| AvoidSector | 避けるセクターデータ |
| PortfolioPosition | 保有ポジション（推奨・評価は持たない。BUG-008） |
| EdinetDetail | EDINET財務詳細と一次資料URL |

---

## 7. コンポーネント一覧

| コンポーネント | ファイル | 役割 |
|---|---|---|
| App | src/App.tsx | ルートコンポーネント。タブナビ管理 |
| MacroView | src/MacroView.tsx | ステップ1：マクロ分析表示 |
| ScreeningView | src/ScreeningView.tsx | ステップ2：スクリーニング結果テーブル |
| DeepDiveView | src/DeepDiveView.tsx | ステップ3：銘柄深掘り分析カード |
| StockCard | src/DeepDiveView.tsx（内部） | 個別銘柄カード（展開/折りたたみ） |
| ScoreBar | src/DeepDiveView.tsx（内部） | 6項目スコアのバー表示 |
| TrapPanel | src/DeepDiveView.tsx（内部） | 罠検出の該当／判定不能／確認済みの内訳表示 |
| PortfolioView | src/PortfolioView.tsx | ポートフォリオ管理画面 |
| PositionCard | src/PortfolioView.tsx（内部） | 保有1件の表示（損益のみ・評価は出さない） |
| EmptyPortfolio | src/PortfolioView.tsx（内部） | 保有未登録時の説明と登録方法 |
| SourceLinks | src/SourceLinks.tsx | 一次資料（有報・決算短信PDF）へのリンク |
| （モジュール） | src/freshness.ts | 鮮度の日数計算としきい値。全画面がここだけを使う |
| SelectionBasis | src/SelectionBasis.tsx | 選定時の業種と現在のマクロ推奨業種の突き合わせ |
| ScreeningRunButton | src/ScreeningRunButton.tsx | フルスクリーニングの実行（確認ダイアログ付き・`screening_run_button.md`） |

---

## 8. 使用ライブラリとその理由

| ライブラリ | バージョン | 採用理由 |
|---|---|---|
| react | 19.0.0 | UIコンポーネント管理 |
| react-dom | 19.0.0 | DOM描画 |
| tailwindcss | 4.0.0 | 高速スタイリング・ユーティリティファースト |
| @tailwindcss/vite | 4.0.0 | Vite統合プラグイン |
| vite | 6.0.0 | 高速ビルド・HMR |
| typescript | 5.6.0 | 型安全性の確保 |

---

## 9. 既知の課題・制限事項

| ID | 内容 | 優先度 |
|---|---|---|
| L-01 | src/data.ts がサンプルデータ固定のため、pipeline.py 実行結果を自動反映する仕組みがない | 高 |
| L-02 | 株価・損益はリアルタイム取得ではなくデータ.ts記載値固定 | 高 |
| L-03 | 画面幅 768px 未満でテーブルが横スクロールになりモバイル最適化が不十分 | 中 |
| L-04 | ポートフォリオのポジション追加・編集・削除のUI未実装 | 中 |
| L-05 | 過去の分析結果（履歴）の保存・比較機能なし | 低 |
| L-06 | ダッシュボード上でのプリセット変更・業種コード変更による再スクリーニング機能なし | 低 |
| ~~L-07~~ | ~~`update_data.py` が `edinetDetails` を更新しない~~ → **2026-09-02 解消**。`fetch_stocks.py` が EDINET の財務詳細を `screening_result.json` に保存し、`update_data.py` が `edinetDetails` を再生成するようにした | 済 |
| ~~L-09~~ | ~~スクリーニング画面のサマリーカードが固定値~~ → **2026-09-03 解消**（BUG-005）。`screening_meta.json` 経由で実測値を表示 | 済 |
| L-08 | **2026-09-04 一部解消**。6項目評価のうち②モメンタム・④バリュエーション・⑤下値リスク・⑥配当（計65点ぶん）を実装し画面に表示。①カタリスト（決算発表予定日が未取得）と③需給・テクニカル（信用倍率・出来高が未取得）は「未算出」表示のまま。決算サマリー・プラス材料/リスク・最終評価も未実装 | 中 |
| ~~L-10~~ | ~~`deepStocks` / `DeepStock` 型が未参照のまま残っている~~ → **2026-09-10 解消**（BUG-008）。手書きの `verdict` / `positives` / `risks` を抱えていたため型ごと削除 | 済 |
| L-11 | ポートフォリオの保有銘柄は `src/data.ts` の手書き。`update_data.py` の更新対象外のため、スクリーニングを回しても連動しない（BUG-008 で架空データは撤去済み・登録UIは L-04） | 中 |
| ~~L-14~~ | ~~銘柄の入れ替えがUIから実行できない~~ → **2026-09-17 解消**。`ScreeningRunButton` を追加（確認ダイアログ・同日2回目のガード・実行前バックアップ付き）。詳細は `screening_run_button.md` | 済 |
| L-15 | `refresh_prices.py` は score / deepScore / scoreBreakdown を再計算しないため、株価更新後は PER・PBR と④バリュエーション点が一時的に食い違う | 中 |
| L-13 | 鮮度の集計はモジュールのトップレベルで1度だけ評価されるため、日付をまたいでタブを開きっぱなしにすると前日の表示のままになる（リロードで解消。凍結値ではないので保存はされない） | 低 |
| L-12 | 罠検出10ルールのうち「のれんの規模」「有利子負債の水準」は中小型株でXBRLタグ付けが無く判定不能になりやすい（実測: のれん11/15社・有利子負債8/15社が判定不能）。有報本文のパースか他ソースが必要 | 中 |
