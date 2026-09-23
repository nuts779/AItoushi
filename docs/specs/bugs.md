# Bug Reports - 投資

---

## BUG-001: macOS で「マクロ分析を更新」ボタンが exit=127 で失敗する

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-001 |
| 起票日 | 2026-09-01 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `vite-plugin-macro.ts` |

### 再現手順
1. macOS（Homebrew Python・`python3` のみ存在し `python` は無い環境）で `npm run dev` を実行する
2. ステップ1「マクロ分析」タブを開く
3. 「🔄 マクロ分析を更新」ボタンを押す

### 期待動作
`fetch_macro.py` が実行され、記事取得 → Claude 分析 → `src/data.ts` 更新まで進む。

### 実際の動作
進捗パネルが「✗ エラーが発生しました / fetch_macro.py が失敗 (exit=127)」で停止する。

### 原因
`vite-plugin-macro.ts` が `spawn('python', ...)` と Windows 前提のコマンド名を直接指定していた。
macOS 12.3 以降は OS 標準の Python 2 が削除され、Homebrew も `python3` のみを提供するため、
`python` が解決できずシェルが 127（command not found）を返していた。
`shell: true` で起動しているため Node の `error` イベントではなく `close` イベントの
終了コードとして現れ、画面には「Python がインストール済みか確認してください」という
実態と異なる案内が表示され、原因が分かりにくい状態だった。

### 対応（2026-09-01）
- `PYTHON_BIN = process.env.PYTHON ?? 'python3'` を導入し、**既定を `python3`** に変更。
- 環境変数 `PYTHON` で上書き可能にした（Windows: `PYTHON=python npm run dev`）。
- exit=127 の場合に「コマンドが見つかりません。環境変数 PYTHON で指定してください」という
  原因と対処を進捗パネルに表示するようにした。
- 進捗ログ・エラーメッセージにも実際に使用したコマンド名を出すようにした。

### 検証
- `npx vite build` 成功（35 modules）。
- ボタンからのエンドツーエンド実行は未検証（実行すると `claude -p` が走り API 利用料が発生するため、
  ユーザー操作時に確認する）。

---

## BUG-002: `claude -p` にプロンプトが届かず、課金だけ発生して空振りする

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-002 |
| 起票日 | 2026-09-01 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `vite-plugin-macro.ts` |

### 再現手順
1. macOS / Linux（シェルが bash / zsh）で `npm run dev` を実行する
2. ステップ1「マクロ分析」タブの「🔄 マクロ分析を更新」ボタンを押す
3. ① の記事取得は成功するが、② の Claude 分析が中身のない応答で終わる

### 期待動作
`CLAUDE_PROMPT` の全文が `claude -p` に渡り、スキーマどおりの JSON が返って `src/data.ts` が更新される。

### 実際の動作
Claude が「指示本文が届いていません。『以下を厳守してください。』の後が空です」と返答し、
`data.ts` は更新されないまま終了する。**プロンプトが届いていないにもかかわらず API 利用料は発生する**（実測: Opus 5 で出力303トークンのみの空振り応答）。

### 原因
```ts
spawn('claude', ['-p', CLAUDE_PROMPT, ...], { shell: true })
```
`shell: true` は引数をエスケープせずシェルのコマンド文字列に連結する（Node の DEP0190 警告が示すとおり）。
`CLAUDE_PROMPT` には改行・引用符・`**`・そして **バッククォート**（出力スキーマの ```json コードフェンス）が
含まれるため、bash / zsh ではバッククォートがコマンド置換として解釈され、プロンプトが破壊される。
結果として `-p` には先頭の断片しか渡らなかった。
Windows の cmd.exe はバッククォートを特別扱いしないため、開発元の環境では顕在化していなかった。

### 対応（2026-09-01）
- プロンプトを **argv ではなく stdin 経由**で渡すよう変更（`stdio[0]` を `'pipe'` にし、
  `claude.stdin.write(CLAUDE_PROMPT)` → `end()`）。stdin はシェルを経由しないため、
  改行・バッククォートを含む内容がどの OS でもそのまま届く。
- argv に残るのは `-p` `--permission-mode` `acceptEdits` の安全なトークンのみ。
- `claude.stdin` の error を握りつぶし、子プロセスが先に終了した場合に EPIPE で落ちないようにした。

### 検証
- `curl -N -X POST http://localhost:5173/api/fetch-macro` でエンドツーエンド実行し、
  step① → step② → step③ → done まで完走。
- `src/data.ts` が実際に更新されたことを確認（weather: 曇り→晴れ、
  latestArticleDate: 2026-04-12→2026-08-31、targetSectors が最新マクロの5業種に入れ替わり）。
- `npx vite build` 成功。
- 実使用トークン（Opus 5）: cache_create 36,132 / cache_read 70,462 / output 6,458。
  修正前の空振り（output 303）と比べ、実際に分析が行われたことが数値でも確認できる。

---

## BUG-003: update_data.py が pipelineMeta.runDate を更新せず、鮮度バナーが古い日付のままになる

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-003 |
| 起票日 | 2026-09-01 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `scripts/update_data.py` |

### 再現手順
1. `python3 scripts/fetch_stocks.py --industries ... ` でスクリーニングを実行する
2. `python3 scripts/update_data.py` で `src/data.ts` に反映する
3. ダッシュボードのヘッダー右上の鮮度バナーを見る

### 期待動作
本日取得したデータなので「✅ 鮮度: データ最新 ／ 本日更新」と表示される。

### 実際の動作
`screeningStocks` は最新に置き換わるのに、`pipelineMeta.runDate` が古い日付（`2026-04-21`）のまま残り、
バナーが「🔴 要更新 ／ 133日前に更新」＋「refresh推奨」を表示し続ける。
**データは最新なのに古いと警告する**という、本プロジェクトの「鮮度保証」方針と逆方向の誤情報になる。

### 原因
`update_data.py` は `screeningStocks` 配列のみを正規表現で置換しており、`pipelineMeta` を対象にしていなかった。

### 副次的に判明した不具合
同スクリプトの成功判定が `if new_content == content:` になっており、
**同じ結果を再反映したとき（内容が変わらないだけ）を「置換対象が見つかりません」と誤判定して `sys.exit(1)` していた**。
これにより後続処理が実行されず、冪等な再実行ができなかった。

### 対応（2026-09-01）
- `pipelineMeta.runDate` を実行日に更新する処理を追加。置換できなかった場合は警告を出す。
- 成功判定を `re.subn` の置換件数（`hit == 0`）に変更し、「マッチしなかった」と「内容が同一だった」を区別するようにした。
  内容が同一の場合は「（screeningStocks の内容は前回と同一でした）」と表示して処理を継続する。

### 検証
- 再実行して `pipelineMeta.runDate を 2026-09-01 に更新しました` を確認。
- `src/data.ts` の `runDate` が `2026-09-01` になり、経過0日＝バナー判定 `fresh`（✅データ最新）になることを確認。
- `npx vite build` 成功。dev server も HTTP 200 で稼働。

### 未対応（別件）
`edinetDetails` は依然として更新されない。詳細は `docs/specs/dashboard.md` の既知の課題 L-07 を参照。

---

## BUG-004: 通期予想純利益の億円換算が10分の1になる

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-004 |
| 起票日 | 2026-09-02 |
| Severity | medium |
| Status | resolved |
| 対象ファイル | `src/PortfolioView.tsx` |

### 再現手順
1. ポートフォリオ画面の「取得財務データ一覧」を開く
2. 「通期予想純利益」列を見る

### 期待動作
三菱化工機（6331）の通期予想純利益 6,850百万円 → **68.5億** と表示される。

### 実際の動作
**6.8億** と、実際の10分の1で表示される。

### 原因
`EdinetRow` が `(d.forecastNetIncome / 1000).toFixed(1)` としていた。
EDINET DB の決算短信（earnings）の金額は**百万円**単位のため、億円にするには 100 で割るのが正しい。
（検証: `eps 123.97 × average_shares 18,539,448 = 2,298` が `net_income: 2298` と一致することから百万円と確定）

### 対応（2026-09-02）
除数を `/ 1000` → `/ 100` に修正。

### 備考
L-07 対応で `edinetDetails` に実データが入るまで、この列は旧サンプルデータでしか表示されておらず顕在化していなかった。

---

## BUG-005: スクリーニング画面のサマリーカードが固定値で、実行結果と食い違う

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-005 |
| 起票日 | 2026-09-03 |
| Severity | medium |
| Status | resolved |
| 対象ファイル | `src/ScreeningView.tsx`, `scripts/fetch_stocks.py`, `scripts/update_data.py` |

### 再現手順
1. `fetch_stocks.py` を任意の業種で実行し、`update_data.py` で反映する
2. ステップ2「スクリーニング」画面上部のサマリーカードを見る

### 期待動作
その実行の実測値（母集団・1段階目通過・深掘り件数）が表示される。

### 実際の動作
`母集団 3,745社 / JPXマスター全銘柄`、`1段階目 40社` が常に表示される。
2026-09-01 の実行では母集団872社・1段階目263社・深掘り40社だったため、**母集団が4倍以上に誇張**されていた。
母集団は `--industries` で指定した業種のみが対象であり、「JPXマスター全銘柄」という説明自体も誤り。

### 原因
`ScreeningView.tsx` のサマリーカードが文字列リテラルのハードコードだった。
またパイプライン側も件数を出力していなかったため、画面が参照できる実測値が存在しなかった。

### 対応（2026-09-03）
- `fetch_stocks.py`: 実行メタ（`universeCount` / `stage1Count` / `deepCount` / `outputCount` / `preset` / `industries` / `runDate`）を
  `scripts/screening_meta.json` に出力するようにした。
- `update_data.py`: `patch_pipeline_meta()` を追加し、上記を `data.ts` の `pipelineMeta` に反映するようにした。
  メタファイルが無い場合はスキップし、既存の実測値を消さない。
- `ScreeningView.tsx`: サマリーカードとプリセット表示を `pipelineMeta` 参照に変更。
  値が無い古い `data.ts` でも壊れないよう `count()` で `—` にフォールバックする。

### 副次的に修正した点
`update_data.py` が `pipelineMeta.runDate` に**反映日**（`date.today()`）を書き込んでいた。
数日前に取得したデータに今日の日付を貼ると鮮度バナーが緑になり、
「古い値を黙って残さない」という本プロジェクトの方針と逆の誤情報になる。
`screening_meta.json` の `runDate`（スクリーニング実行日）を優先するよう変更した。

### 検証
- 2026-09-01 実行分のメタを実測値で補完し、`pipelineMeta` に
  `universeCount: 872 / stage1Count: 263 / deepCount: 40 / preset: 'stable_defensive'` が入ることを確認。
- `runDate` が反映日（2026-09-03）ではなく実行日（2026-09-01）になることを確認。
- `npx vite build` 成功。dev server HTTP 200。

---

## BUG-006: 財務未取得（unavailable）が握りつぶされ、取得済みとして表示される

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-006 |
| 起票日 | 2026-09-04 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `scripts/update_data.py`, `src/types.ts`, `src/dataSource.ts`(新規), `src/ScreeningView.tsx`, `src/DeepDiveView.tsx`, `src/PortfolioView.tsx` |

### 再現手順
1. EDINET DB のレート制限到達などで一部銘柄の財務取得に失敗する状態でスクリーニングを実行する
2. `update_data.py` で反映し、鮮度バナーとスクリーニング画面を見る

### 期待動作
`data_sources.md` の設計方針どおり、取得できなかった銘柄は `dataSource='unavailable'` として記録され、
鮮度バナーに「財務未取得N件」が赤字で表示される。

### 実際の動作
- `update_data.py` が `dataSource` を `edinet_db` か **`irbank` に丸めていた**ため、
  `unavailable` が `data.ts` に到達せず、鮮度バナーの「財務未取得N件」は**常に0**だった。
- 廃止済みの IRBANK から取得できたかのように表示されるため、実態とも食い違っていた。
- `types.ts` の `dataSource` は `'edinet_db' | 'irbank'` の2値しか許容しておらず、
  `FreshnessBanner.tsx` の `=== 'unavailable'` は型上成立しない比較だった
  （`strict:false` かつビルド時に `tsc` を通さないため素通りしていた）。

### 副次的に判明した不具合
`update_data.py` の `parse_iso_date('')` が**今日の日付**を返すため、財務を取得できていない銘柄の
`irbankDate` に実行日が入っていた。深掘り画面は「財務データ基準日 2026-09-04（0日前）」と表示するため、
データが無いのに最新であるかのように見えていた。BUG-003 と同じ「鮮度について嘘をつく」系統の不具合。

### 対応（2026-09-04）
- `update_data.py`: `normalize_data_source()` を追加し、`unavailable` を他の値へ丸めないようにした
  （`irbank_fallback` のみ `irbank` に正規化、値が無い場合は安全側の `unavailable`）。
- `update_data.py`: 日付が無い銘柄の `irbankDate` に今日を入れず、空文字にした。
- `types.ts`: `Stock.dataSource` / `EdinetDetail.dataSource` に `'unavailable'` を追加。
- `src/dataSource.ts`（新規）: 取得元のラベル・バッジ配色を1か所に集約。3画面で重複していた分岐を統一し、
  未設定値は安全側（未取得）に倒す。
- 画面: スクリーニング＝「財務未取得」を赤字表示、深掘り＝取得元バッジと「基準日なし／取得できていません」、
  ポートフォリオ＝「財務未取得N社」バッジを追加。
- `pipelineMeta` に `edinetCount` / `unavailableCount` を実測値で反映するようにした
  （`patch_pipeline_meta()` は値が None のキーを書き換えない。null で実測値を潰さないため）。

### 検証
- 実データに `unavailable` が出ない（APIキーが有効で40社すべて取得成功）ため、合成データで生成経路を検証した。
  - `normalize_data_source()`: `unavailable` / `None` / `''` が `unavailable` として保持されることを確認。
  - `generate_stock_ts()`: `dataSource: 'unavailable'` かつ `irbankDate: ''` が出力されることを確認。
  - 取得済み銘柄では `irbankDate: '2026-08-15'` が保持されることを確認（退行なし）。
- 実データで `update_data.py` を再実行し、15社の反映と `pipelineMeta` の実測値を確認。
- `npx vite build` 成功。

---

## BUG-007: 3日前の株価を「データ最新」と表示する

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-007 |
| 起票日 | 2026-09-04 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `src/FreshnessBanner.tsx`, `src/DeepDiveView.tsx`, `scripts/refresh_prices.py`(新規), `scripts/update_data.py`, `vite-plugin-macro.ts`, `src/PriceRefreshButton.tsx`(新規) |

### 再現手順
1. スクリーニングを実行し、数日置いてからダッシュボードを開く

### 期待動作
株価が数日前のものであれば、鮮度バナーがその旨を警告する。

### 実際の動作
2026-09-01 取得の株価に対し 2026-09-04 時点で「✅ データ最新」と表示された。
このとき実際の株価は最大 **-3.6%**（ハードオフ 2,705→2,607円）乖離しており、
同じ株価から算出される PER・PBR も同様に古い値だった。
深掘り画面の「株価・指標（yfinance） 2026-09-01**（当日）**」も、
「（当日）」が文字列でハードコードされており日が経つほど誤表示になっていた。

### 原因
1. **株価と財務が `pipelineMeta.runDate` ひとつを共有していた。**
   株価は毎営業日変わり、財務は四半期に一度しか変わらない。閾値（`staleWarnDays: 7`）を
   どちらに合わせても、もう一方の鮮度が必ず嘘になる構造だった。
2. **株価だけを更新する手段が無かった。** 全体再実行は872社走査で約13分・EDINET 80リクエストを要し、
   株価鮮度のために回すには重すぎた。
3. カレンダー日数で判定していたため、営業日を考慮できていなかった。

### 対応（2026-09-04）
- **日付の分離**: `pipelineMeta` に `priceDate` / `priceFailedCount` を追加。
  `runDate` は財務（スクリーニング実行日）を表す。
- **鮮度バナーを2系統に分割**: 「株価」は**営業日ベースで2営業日以内=最新 / 4営業日以内=注意 / それ以降=要更新**、
  「財務」は従来どおりカレンダー日数（7日 / 30日）で判定する。
- **`scripts/refresh_prices.py`（新規）**: 現在ダッシュボードに載っている銘柄の株価・PER・PBR・配当・52週高安のみを
  取り直す。財務データ（equityRatio / trapFlag / scoreBreakdown / edinetDetail）には一切触れない。
  15銘柄で約12秒、EDINETリクエスト消費は0回。取得失敗銘柄は件数を記録し、古い値を新しく見せない。
- **画面から実行可能に**: `/api/refresh-prices` エンドポイントと `PriceRefreshButton` を追加。
  Claude を呼ばないため**課金は発生しない**。
- 深掘り画面の「（当日）」固定表記を `priceDate` 参照に変更。

### 副次的に修正した点
各スクリプトが `sys.stdout = io.TextIOWrapper(sys.stdout.buffer, ...)` で stdout を上書きしており、
別スクリプトから import すると前のラッパーが破棄されて元の buffer ごと閉じられ、
`ValueError: I/O operation on closed file.` で落ちていた。
`sys.stdout.reconfigure(encoding='utf-8')` に統一（`fetch_stocks` / `update_data` / `edinet_fetcher` / `fetch_macro`）。

### 営業日判定の制限事項
祝日は考慮していない。祝日を営業日として数えるぶん経過日数は多めに出るが、
「実際より古く見える」方向の誤差であり、鮮度判定としては安全側に倒れる。

### 検証
- 営業日判定: 金曜取得→月曜確認=1営業日（✅最新／週明けの誤警告なし）、
  金曜→水曜=3営業日（⚠️）、9/1取得→9/4確認=3営業日（⚠️。修正前は「✅最新」だった）。
- `refresh_prices.py` 実行: 15銘柄更新・失敗0件・約12秒。ミクロン精密 +5.0% など実際の変動を反映。
- `/api/refresh-prices` をエンドツーエンドで実行し done まで完走。
- `npx vite build` 成功。

---

## BUG-008: 根拠のない「◎ 強推奨」バッジが出ていた

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-008 |
| 起票日 | 2026-09-10 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `src/data.ts`, `src/types.ts`, `src/PortfolioView.tsx` |

### 再現手順
1. ポートフォリオ画面を開く

### 期待動作
表示される推奨・評価には計算根拠があり、根拠が無いものは表示しない。

### 実際の動作
5銘柄に「◎ 強推奨」「○ 買い」バッジと推奨文が表示されていた。
- バッジの元は `data.ts` の `verdictRating` という**手書きの固定文字列**で、計算されたものではない。
- 銘柄は2026年4月時点のサンプル（システムリサーチ・ダブルスタンダード等）で、
  現在のスクリーニング結果（三菱化工機・千代田インテグレ等）と**1社も一致しない**。
- `buyPrice` と `currentPrice` が全銘柄で同値、つまり一度も保有していない架空データだった。

画面上はこれが本物の保有・本物の推奨と区別できず、
「このシステムは買えと言わない（判断は人間が下す）」という運用方針に真っ向から反していた。

### 原因
プロトタイプ初期のダミーデータが、パイプライン実装後も更新経路を持たないまま残っていた。
`update_data.py` は `screeningStocks` と `edinetDetails` しか再生成しないため、
`portfolioPositions` はスクリーニングを何度回しても4月のまま固定される構造だった。

### 対応（2026-09-10）
- `VerdictRating` 型・`PortfolioPosition.verdict` / `verdictRating` を削除。
- `portfolioPositions` を空配列にし、書き方の例を添えた空状態を表示するようにした。
  ポジションカードは買値・現在値・含み損益・配分という**事実のみ**を出し、評価は出さない。
  自分で書いたメモは `note` として区別できるようにした。
- 未参照のまま手書きの `verdict` / `positives` / `risks` を抱えていた
  `deepStocks` と `DeepStock` 型も削除（L-10 の解消）。

### 検証
- `npx tsc --noEmit` / `npx vite build` 成功。
- ポートフォリオ画面に推奨バッジが1つも出ないこと、空状態が表示されることをブラウザで確認。

---

## BUG-009: 罠検出が「判定不能」を「該当なし」と同じ扱いにしていた

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-009 |
| 起票日 | 2026-09-10 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `scripts/edinet_fetcher.py`, `scripts/fetch_stocks.py`, `scripts/update_data.py`, `src/types.ts`, `src/DeepDiveView.tsx`, `src/ScreeningView.tsx` |

### 再現手順
1. スクリーニングを実行し、IFRS採用企業（例: エフ・シー・シー 7296）の罠フラグを見る

### 期待動作
評価できなかったルールは「判定不能」として、評価して問題が無かったものと区別して表示される。

### 実際の動作
すべて `normal`（罠なし）と表示されていた。
実際には、
- ルール3（特別利益の上乗せ）は IFRS に経常利益の概念が無いため**そもそも成立していない**
- 過去4期ぶんのROE/EPSが無い銘柄ではルール1・2が**評価されていない**

にもかかわらず、画面上は「罠検出を通過した」ようにしか見えなかった。

### 原因
`detect_trap_v2()` が「該当した理由」しか返しておらず、
データ不足でルールをスキップした場合と、評価して該当しなかった場合が
呼び出し側から区別できない設計だった。

### 対応（2026-09-10）
- `detect_trap_v2()` の戻り値を `(flag, reasons, undetermined, delta)` の4要素に変更。
  `undetermined` には「ルール名: なぜ測れないか」を積む。
- **ルールを5→10に拡張**。EDINETから取得済みで未使用だった項目を使う（詳細は `data_sources.md` §5.6）。
- `Stock.trapUndetermined` を追加し、深掘り画面に
  「該当 N · 判定不能 N · 確認済み N」の内訳と判定不能の理由一覧を表示。
  スクリーニング画面にも判定不能の一覧セクションを追加。
- 財務を取得できなかった銘柄（`dataSource: 'unavailable'`）は全10ルールを判定不能として記録する。

### 検証
- キャッシュのみ（APIリクエスト0回）で15社を再計算し、6社が新ルールに該当した。
  実数値をEDINET原本と突き合わせて誤検出でないことを確認：
  - 三菱化工機(6331): 純利益75.5億に対し営業CF 18.0億（前期は▲33.1億）
  - 電業社機械製作所(6365): 売上+0.4%に対し売上債権 80.1→101.7億（+27%）、営業CF 21.1→5.3億
  - アプライド(3020): 売上+1.5%に対し在庫 10.1→16.3億（+62%）
  - 西部技研(6223): 売上+7%に対し売上債権 68.8→93.3億（+36%）
- 判定不能は15社で計20件。内訳はのれん未タグ付け11件・有利子負債8件・IFRS1件。

---

## BUG-010: 「深掘り対象」バッジと深掘り画面の表示条件が食い違っていた

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-010 |
| 起票日 | 2026-09-10 |
| Severity | medium |
| Status | resolved |
| 対象ファイル | `src/ScreeningView.tsx`, `src/DeepDiveView.tsx` |

### 再現手順
1. スクリーニング画面で「深掘り対象」バッジの付いた銘柄数を数える
2. 深掘り分析タブを開いて銘柄数を数える

### 期待動作
両者が一致する。

### 実際の動作
バッジは11社に付くのに、深掘り分析タブには4社しか出なかった。
`ScreeningView` は `deepScore >= 70`、`DeepDiveView` は `deepScore >= 90` という
別々のハードコード閾値を使っていた。

BUG-009 の対応で罠検出の減点が入るまでは全15社が87〜93点に収まっており、
どちらの閾値でもほぼ全社が該当していたため矛盾が表面化していなかった。

### 対応（2026-09-10）
- スクリーニング最終出力の15社は全社がEDINET深掘り済みであるため、
  `DeepDiveView` の点数フィルタを撤廃し全社を表示するようにした。
  罠検出で減点された銘柄（＝最も詳しく見たい銘柄）が画面から消える問題も同時に解消する。
- 意味を失った「深掘り対象」バッジを撤去し、代わりに深掘り画面のヘッダーへ
  「罠検出あり N社」バッジを追加した。

### 検証
- 深掘り分析タブに15社すべてが表示され、ヘッダーが「罠検出あり 6社」となることを確認。

---

## BUG-011: 財務データの「取得日」に画面を更新した日が入っていた

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-011 |
| 起票日 | 2026-09-10 |
| Severity | medium |
| Status | resolved |
| 対象ファイル | `scripts/update_data.py` |

### 再現手順
1. スクリーニングを実行した数日後に `python3 scripts/update_data.py` だけを再実行する
2. ポートフォリオ画面の「取得財務データ一覧」の取得日を見る

### 期待動作
財務データを実際に取得した日（＝スクリーニング実行日）が表示される。

### 実際の動作
`generate_edinet_detail_ts()` が `fetchDate` に `date.today()` を書き込んでいたため、
既存の結果を再反映しただけでも「今日取得した」ことになっていた。
`pipelineMeta.runDate` は BUG-006 で実行日基準に直してあったが、
`edinetDetails.fetchDate` と `screeningStocks` のヘッダーコメントに同じ問題が残っていた。

### 対応（2026-09-10）
`main()` で `screening_meta.json` の `runDate` を先に確定させ、
`fetchDate` とヘッダーコメントの両方をそれに合わせた。
併せて `to_ts_value()` が文字列をエスケープするようにした
（決算短信タイトルなど外部由来の文字列にクォートが含まれると `data.ts` が壊れるため）。

### 検証
- 2026-09-10 に再反映して `fetchDate: '2026-09-01'` となることを確認。
- `npx vite build` 成功。

---

## BUG-012: 夜間に株価を更新すると前営業日の終値に当日の日付が付く

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-012 |
| 起票日 | 2026-09-10 |
| Severity | medium |
| Status | resolved |
| 対象ファイル | `scripts/fetch_stocks.py`, `scripts/refresh_prices.py` |

### 再現手順
1. 取引時間外（夜間・休日）に `python3 scripts/refresh_prices.py` を実行する
2. 鮮度バナーの「株価」を見る

### 期待動作
実際に値が付いた日を基準に鮮度を判定する。

### 実際の動作
`meta['priceDate'] = date.today().isoformat()` としていたため、
2026-09-10 00:30 の実行で priceDate が `2026-09-10` になった。
このとき yfinance が返していたのは `regularMarketTime = 2026-09-09 15:30 JST`、
つまり**前営業日の終値**であり、鮮度バナーが1日ぶん新しく表示される状態だった。

BUG-007 で株価と財務の日付を分離したが、株価側の日付の作り方が
「実行日」のままだったため、同じ種類の誤表示が残っていた。

### 対応（2026-09-10）
- `fetch_stocks.quote_date()` を追加。`info['regularMarketTime']` を
  `exchangeTimezoneName`（東証なら Asia/Tokyo）のローカル日付に変換して返す。
  `fetch_yfinance()` の戻り値に `price_date` として含める。
- `refresh_prices.py` / `fetch_stocks.py` はこれを集計して `priceDate` に書く。
  銘柄によって基準日が割れた場合は**いちばん古い日**を採用する
  （「全銘柄が少なくともこの日時点」と言える側に倒すため）。取得できなければ従来どおり実行日。

### 検証
- 2026-09-10 00:30 に `refresh_prices.py` を実行し、`priceDate: 2026-09-09` となることを確認
  （修正前は `2026-09-10`）。15銘柄すべて基準日が一致。
- `yfinance` の生データで `regularMarketTime = 1788935400` → 2026-09-09 15:30 JST、
  `exchangeDataDelayedBy = 20`、`marketState = PREPRE` を確認。

---

## BUG-013: 同じ銘柄の鮮度タグが画面によって食い違う

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-013 |
| 起票日 | 2026-09-13 |
| Severity | medium |
| Status | resolved |
| 対象ファイル | `src/freshness.ts`(新規), `src/types.ts`, `src/ScreeningView.tsx`, `src/DeepDiveView.tsx`, `src/FreshnessBanner.tsx`, `scripts/update_data.py` |

### 再現手順
1. スクリーニングを実行してから日数を置く（今回は 2026-09-01 実行 → 2026-09-13 に確認）
2. スクリーニング画面と深掘り画面で同じ銘柄の鮮度タグを見比べる

### 期待動作
同じ銘柄の鮮度タグは、どの画面でも同じ値になる。

### 実際の動作
ミクロン精密（6159・Q3決算 2026-07-13 開示）で、
- スクリーニング画面: `normal`
- 深掘り画面: `[stale]`

と逆の判定が出ていた。どちらも隣には同じ「62日前」を表示していた。
連動して「財務鮮度サマリー」も `normal 15 / stale 0` と誤り（正しくは `normal 14 / stale 1`）。

### 原因
鮮度の計算が2か所に分かれ、**基準にする日が違っていた**。

| | 計算場所 | 基準日 | 62日経過時の判定 |
|---|---|---|---|
| スクリーニング画面 | `edinet_fetcher.calc_freshness_edinet()` が実行時に計算し `data.ts` に凍結 | **スクリーニング実行日（9/01）** | 実行時は49日 → `normal` のまま固定 |
| 深掘り画面 | `DeepDiveView` が描画時に計算 | **今日（9/13）** | 62日 → `stale` |

閾値（30 / 60 / 90日）は両者同じで、ずれの原因は日付の凍結だけだった。
BUG-005〜007 / 011 / 012 と同じ「実行時点の値を保存して後から嘘になる」系統の問題。

時限式で、9/27 以降ほぼ毎日どれかの銘柄がずれ始める状態だった
（アマノ 9/27、ノジマ 9/29、三菱化工機 9/30、10/07 に5社）。

### 対応（2026-09-13）
- **`src/freshness.ts` を新設**し、日数計算としきい値をここだけに置いた。
  `calendarDaysSince()` / `businessDaysSince()` / `freshnessOf()` / `freshnessCounts()` と
  `FRESHNESS_DAYS`（30/60/90）・`PRICE_BIZ_DAYS`（2/4）・`MACRO_DAYS`（7/14）。
- **`Stock.freshness` を型ごと削除**し、`update_data.py` が `data.ts` に書き出すのをやめた。
  凍結値を持たなければ、実際とずれようがない。
- スクリーニング画面・深掘り画面・鮮度バナーはすべて `freshnessOf(irbankDate)` を使う。
  深掘り画面が持っていた閾値のコピー（`daysSince` と `>90 / >60 / >30` の分岐）も撤去した。
- `screening_result.json` には従来どおり `freshness` が残るが、これは実行時のコンソール表示用。
  `update_data.py` の出力にも「実行時点の参考値」と明記した。

### 検証
- ミクロン精密が両画面とも `stale`（62日前）になることを確認。鮮度サマリーも `normal 14 / stale 1` に修正された。
- ブラウザの時計を差し替えて追従を確認（全15社で2画面の判定が一致）:
  - 2026-09-14 → 株価 ⚠️3営業日前 / stale 1
  - 2026-10-08 → 財務 🔴37日前 / normal 1・stale 14
  - 2026-12-01 → 🔴91日前 / critical 15
- `npx tsc --noEmit` が `data.ts` に残っていた15件の `freshness` を検出。再生成して解消。
- `npx vite build` 成功・JSエラーなし。

### 制限事項
鮮度の集計はモジュールのトップレベルで1度だけ評価されるため、
日付をまたいでタブを開きっぱなしにすると表示が前日のままになる。リロードで解消する。
凍結値と違い `data.ts` には残らないため、誤った値が保存され続けることはない。

---

## BUG-014: マクロ分析だけ鮮度が分からない

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-014 |
| 起票日 | 2026-09-13 |
| Severity | low |
| Status | resolved |
| 対象ファイル | `vite-plugin-macro.ts`, `src/data.ts`, `src/FreshnessBanner.tsx`, `src/MacroView.tsx`, `src/freshness.ts` |

### 再現手順
1. マクロ分析を実行してから日数を置き、マクロ画面を開く

### 期待動作
マクロ分析がいつのもので、古くなっていないかが分かる。

### 実際の動作
画面に出るのは「参考記事の最新日」だけで、**分析自体をいつ走らせたか**が分からなかった。
鮮度バナーも株価と財務の2本しか無く、マクロは対象外だった。

マクロが決める `targetSectors` はスクリーニングの業種絞り込みに連動するため、
マクロが古いと銘柄選定の前提そのものが古くなる。

### 対応（2026-09-13）
- `macroMeta.generatedDate` を追加。`vite-plugin-macro.ts` が分析実行時に書き込む
  （Claude の出力ではなくサーバ側で採る。実行時刻を知っているのはこちらだけのため）。
- 鮮度バナーに3本目の「マクロ」pill を追加。しきい値は `MACRO_DAYS`（7日以内=fresh / 14日以内=warn）で、
  週末にマクロを更新する運用リズムに合わせた。
- マクロ画面にも「この分析の実行日 YYYY-MM-DD（N日前）」を色分けで表示。
- **記事日付での代用はしない。** 1か月前の分析でも参照記事が新しければ緑になってしまうため、
  `generatedDate` が無い古い `data.ts` では「実行日不明 / 再実行してください」と赤で出す。

### 検証
- 既存分は `scripts/macro_raw.txt` の実 mtime（2026-09-09 21:40）に合わせて `2026-09-09` をバックフィル。
  バナーが「✅ マクロ 4日前」、マクロ画面が「この分析の実行日 2026-09-09（4日前）」となることを確認。
- `generatedDate` を一時的に削除して「🔴 マクロ 実行日不明 / 再実行してください」を確認（JSエラーなし）。
- 時計差し替えで 2026-10-08 に「🔴 マクロ 29日前」へ遷移することを確認。

---

## BUG-015: JPXの銘柄マスターURLが404になりスクリーニングが実行不能

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-015 |
| 起票日 | 2026-09-15 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `scripts/fetch_stocks.py` |

### 再現手順
1. `python3 scripts/fetch_stocks.py --industries ... --preset stable_defensive --top 15` を実行する

### 期待動作
JPXの銘柄マスターを取得し、スクリーニングが進む。

### 実際の動作
`[1/4] JPXマスター取得中...` の直後に落ちた。

```
ValueError: Excel file format cannot be determined, you must specify an engine manually.
```

### 原因
JPXが配布ファイルの拡張子を **`data_j.xls` → `data_j.xlsx`** に変更しており、
旧URLは **HTTP 404** を返すようになっていた。

`fetch_jpx_master()` が `r.status_code` も Content-Type も確認せず、
404のHTMLページ（21KB）をそのまま `pd.read_excel()` に渡していたため、
「URLが死んでいる」という本当の原因とは無関係な例外になり、原因が分かりにくかった。

スクリーニングは全機能の入口なので、**銘柄の選び直しが一切できない状態**だった。
（株価更新とマクロ更新はJPXを使わないため動いており、気づきにくかった）

### 対応（2026-09-15）
- URLを `.xlsx` に更新。旧 `.xls` も予備として残し、順に試す（`JPX_MASTER_URLS`）。
- **レスポンスを検証する**: `status_code != 200` と Content-Type が HTML の場合は次のURLへ。
  すべて失敗したら、試したURLと失敗理由、配布ページのURL
  （https://www.jpx.co.jp/markets/statistics-equities/misc/01.html ）を添えて `SystemExit` で止める。
- 列数が想定（10列）と違う場合もフォーマット変更として停止する。
- 業種コードに該当0社の場合も、後段で無駄に時間を使う前に停止する。

### 検証
- 新URLから 228KB / 4,441行を取得できることを確認。
- 業種コード 7050,7150,3050,3650,2050 で 561社（銀行79・保険11・食料品120・電気機器217・建設134）を取得。
- 旧URLは HTTP 404 / `text/html` を返すことを確認し、予備URLの分岐が働くことを確認。

### 備考
外部サイトのURL直書きは同じ壊れ方を繰り返す。`data_j` のリンクは配布ページから辿れるため、
将来的にはページをパースしてURLを解決する方が堅牢（未実装）。

---

## BUG-016: pipelineMeta の配列値を書き換えると data.ts が壊れる

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-016 |
| 起票日 | 2026-09-15 |
| Severity | medium |
| Status | resolved（作り込む前に検出） |
| 対象ファイル | `scripts/update_data.py` |

### 再現手順
1. `pipelineMeta` に配列の値（`screenedIndustries: [7050, 7150, 3050]` など）を持たせる
2. `update_data.py` を2回実行する

### 期待動作
配列全体が新しい値に置き換わる。

### 実際の動作
`patch_pipeline_meta()` の正規表現が

```python
pattern = rf'(\n  {key}: )[^,\n]*(,)'
```

で、`[^,\n]*` が**配列の最初のカンマで止まる**。
`screenedIndustries: [7050, 7150, 3050],` に対して `[7050,` までしか一致せず、
置換すると ` 7150, 3050],` が行に取り残されて `data.ts` が構文エラーになる。

初回（キーが存在しない）は末尾に追記する経路を通るため壊れず、
**2回目の実行で初めて壊れる**という発見しにくい形だった。

### 対応（2026-09-15）
行末のカンマまでを対象にする非貪欲マッチへ変更した。

```python
pattern = rf'(\n  {key}: )[^\n]*?(,)(?=\n)'
```

### 検証
配列を含む `pipelineMeta` に対して、配列の置換・新規キーの追加・他キーの保全を確認。
`screenedIndustries` の旧値（3600 / 6100）が残らないこと、
`priceDate` や `staleWarnDays` が壊れないことを assert で確認した。

---

## BUG-017: 種類株式が普通株と別銘柄として上位15社に混入する

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-017 |
| 起票日 | 2026-09-15 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `scripts/fetch_stocks.py` |

### 再現手順
1. 建設業（2050）を含む業種でスクリーニングを実行する
2. 結果の上位15社を見る

### 期待動作
1社が1枠を占める。普通株だけが対象になる。

### 実際の動作
**インフロニア・ホールディングスが3位と15位の2枠を占めた。**

```
  3  50765  インフロニア・ホールディ     91  normal
 15  5076   インフロニア・ホールディ     81  suspicious
```

`50765` は「インフロニア・ホールディングス**第１回社債型種類株式**」で、普通株ではない。
しかも普通株（5076・81点）より高い91点がつき、上位に食い込んでいた。
15枠のうち1枠が実質的に失われ、本来16位だった銘柄が押し出されていた。

### 原因
JPXの銘柄マスターには種類株式・優先株が含まれる。これらは
**親会社と同じ市場区分（プライム（内国株式））・同じ33業種コード**で登録されているため、
既存のフィルタ（市場区分・業種コード・ETF除外）をすべて通過してしまう。

唯一の構造的な違いは**銘柄コードが5文字**であること
（JPXの通常の銘柄コードは4文字。数字のほか `253A` のような英数字もある）。
対象業種には該当が2件あった。

```
25935  伊藤園第１種優先株式
50765  インフロニア・ホールディングス第１回社債型種類株式
```

BUG-015 で `.xls` → `.xlsx` にURLを更新するまでスクリーニング自体が動かなかったため、
この混入は今回初めて表面化した。

### 対応（2026-09-15）
銘柄コードが4文字（`[0-9A-Z]{4}`）のものだけを残す。
除外した銘柄はコードと名称を実行ログに出し、黙って落とさないようにした。

```python
is_common = df['code'].str.fullmatch(r'[0-9A-Z]{4}')
```

### 検証
- 対象業種の母集団 561社 → 559社。除外2件が `25935 伊藤園第１種優先株式` と
  `50765 インフロニア・ホールディング` であることをログで確認。
- 重複コード0件・4文字以外0件。インフロニアは `5076`（普通株）のみが残ることを確認。
- 英数字コード（`253A ＥＴＳグループ`）が除外されないことを確認。

### 備考
種類株式は yfinance でも普通株と別ティッカーとして値がつくため、
PER・配当利回りが普通株と乖離し、スコアが不当に高く出ることがある（今回は91点 vs 81点）。
市場区分や業種では区別できないため、コード長での判定が必要。

---

## BUG-018: macOS への移植で Windows が動かなくなっていた

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-018 |
| 起票日 | 2026-09-18 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `vite-plugin-macro.ts`, `scripts/fetch_stocks.py`, `requirements.txt`(新規), `CLAUDE.md` |

### 背景
本プロジェクトは **Windows と macOS の両方で開発されている**。
BUG-001（macOS に `python` が無い）の対応で既定を `python3` に変えた際、
Windows 側の動作を確認しておらず、**移植元の環境が動かない状態**になっていた。

### 実際の動作（Windows）

| # | 症状 | 原因 |
|---|---|---|
| 1 | **すべてのボタンが動かない** | `PYTHON_BIN` の既定が `python3`。python.org のインストーラが作るのは `python.exe` / `py.exe` で `python3.exe` は無い。さらに Windows の「アプリ実行エイリアス」が反応して Microsoft Store が開く |
| 2 | エラーの原因が分からない | コマンド未検出の終了コードを `127`（Unix系）だけで判定していた。cmd.exe が返すのは **9009** |
| 3 | **株価の基準日が静かに壊れる** | Windows には OS のタイムゾーンDBが無く `ZoneInfo('Asia/Tokyo')` が失敗する。`except Exception: return None` で握りつぶしていたため `date.today()` にフォールバックし、**BUG-012（前営業日の終値に当日の日付が付く）が警告なしに復活**していた |
| 4 | 新しいスクリーニングボタンだけ動かない環境がある | `shell: false` の `spawn` は Node 18.20.2 以降のセキュリティ強化により Windows で `.bat` / `.cmd` を起動できない（conda や一部の venv ラッパー） |
| 5 | 中止してもプロセスが残る | Windows で `shell: true` のとき、`SIGTERM` では親の cmd.exe しか止まらない |

3 が最も質が悪い。落ちも警告も出さずに誤った日付を表示するため、
「古い値を黙って残さない」という本プロジェクトの原則に真っ向から反していた。

### 対応（2026-09-18）
- **`CLAUDE.md` に「最重要ルール: クロスプラットフォーム対応」を追加**。
  同種の退行を繰り返さないよう、必須要件とチェックリストを明文化した。
- `PYTHON_BIN` を `process.platform === 'win32' ? 'python' : 'python3'` で自動判定
  （環境変数 `PYTHON` が最優先なのは従来どおり）。
- `isCommandNotFound()` を追加し **127 / 9009 / ENOENT** を等しく扱う。
  案内文も OS ごとに例を出し分ける（`set PYTHON=py` / `PYTHON=python3.12`）。
- **タイムゾーンのフォールバックを明示化**（`_exchange_tz()`）。
  東証は夏時間が無く通年 UTC+9 で固定なので、`tzdata` が無い場合は
  **固定オフセットで代替する（近似ではなく正確な値）**。理由はログに出す。
  代替できない取引所は、鮮度が実際より新しく見える旨を警告して `None` を返す。
- スクリーニング実行の `spawn` は Windows のみ `shell: true`
  （引数は `^\d{4}(,\d{4})*$` 等で厳格に検証済みのため注入の余地はない）。
- Windows での中止は `taskkill /T /F` でプロセスツリーごと停止する。
- **`requirements.txt` を新規作成**し、`tzdata; platform_system == "Windows"` を条件付き依存として明記。

### 検証
- **tzdata 欠如の再現**: `ZoneInfo` を必ず失敗させた状態で `fetch_yfinance()` を実行し、
  `price_date` が通常時と**同じ値**（2026-09-18）になることを確認。警告も出る。
  代替できないタイムゾーン（America/New_York）では警告して `None` を返すことも確認。
- **Python 未検出**: `PYTHON=python3_does_not_exist` で dev server を起動し、
  `shell: true` 経路（exit=127）・`shell: false` 経路（ENOENT）の**両方**で
  案内文が出ることを確認。
- macOS 側の退行なし: `tsc --noEmit` / `vite build` / `refresh_prices.py` 実走 / 入力検証（注入対策）。

### 制限事項
**Windows 実機での動作確認はできていない。** 上記は静的解析と各プラットフォームの
既知の仕様、および失敗状況の再現テストに基づく。Windows 側のメンバーによる確認が必要。

### 追記（2026-09-23）
その後 GitHub Actions の `windows-latest` で実機確認できるようにした
（`docs/specs/ci_platform_check.md`）。その結果、**本項目の修正2に誤りが見つかった**
（終了コード 9009 の前提が実機で成り立たなかった。BUG-021 参照）。
現在は項目1・2・3・5 および パス／ファイル名 が実機で緑になっている。
項目4（conda / venv の `.bat` ラッパー）と Microsoft Store のアプリ実行エイリアスは
CI では再現できないため、**Windows 側のメンバーによる確認が引き続き必要**。

---

## BUG-019: 画面に表示・コピーされるコマンドが `python3` 固定で Windows では動かない

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-019 |
| 起票日 | 2026-09-23 |
| Severity | high |
| Status | resolved |
| 対象ファイル | `src/data.ts`, `src/pythonCommand.tsx`(新規), `src/MacroView.tsx`, `src/SelectionBasis.tsx`, `src/PriceRefreshButton.tsx`, `vite-plugin-macro.ts`, `docs/specs/ui/macro.md` |

### 再現手順
1. Windows で `npm run dev` を実行し、ブラウザで「ステップ1 マクロ分析」を開く
2. 「Claude Code 実行コマンド」欄の表示、または「コピー」ボタンでコピーした文字列を
   PowerShell / コマンドプロンプトに貼り付けて実行する

### 期待する動作
その環境で実際に動くコマンドが表示・コピーされる（Windows なら `python ...`）。

### 実際の動作
`python3 scripts/fetch_stocks.py ...` が表示され、コピーしても実行できない。
単に「コマンドが見つかりません」と出るのではなく、Windows の**アプリ実行エイリアス**が
反応して **Microsoft Store の Python ページが開く**ため、
Python はインストール済みなのに原因が分からない状態になる。

### 原因
BUG-018 では `spawn()` でサーバが実際に起動する側（`PYTHON_BIN`）だけを OS 判定にし、
**画面に表示・コピーされる文字列を直していなかった**。

```ts
// 修正前 src/data.ts
export const generatedCommand =
  `python3 scripts/fetch_stocks.py --industries ${targetIndustryCodes} ...`;
```

これはブラウザ側のコードなので、サーバの OS を知る手段が無く、Windows でも `python3` のまま出る。

さらに `data.ts` は **片方の OS で生成したものを両メンバーが共有する**ファイルである。
生成時の OS を焼き込む方式にすると、Mac で生成した `data.ts` を Windows 側が開いたときに
必ず間違ったコマンドが表示される。
**実行環境に依存する値を `data.ts` に凍結してはいけない**という点で、
鮮度タグを凍結していた BUG-013 と同じ構図。

該当箇所は4つ:

| 箇所 | 内容 |
|---|---|
| `data.ts` → `MacroView.tsx` | コマンド表示＋コピーボタン（`navigator.clipboard`） |
| `SelectionBasis.tsx` | 業種ドリフト時の再実行コマンド |
| `PriceRefreshButton.tsx` | 失敗時の案内「既定: python3」 |
| `docs/specs/ui/macro.md` | 「既定は `python3`」と記載（BUG-018 以降は誤り） |

加えて `MacroView.tsx` の案内文が
「**PowerShellで** `~/stock-analysis/` に移動後」と Windows 決め打ちで、
かつ **存在しない `final_ranking.csv`** を貼り付けるよう指示していた
（初期設計の残骸。現在の経路は `screening_result.json` → `update_data.py`）。

### 対応（2026-09-23）
- **`GET /api/env` を追加**（`vite-plugin-macro.ts`・副作用なし・課金なし）。
  実際に `spawn` する側が `PYTHON_BIN` の実値を申告する。
  返すのはコマンド名・OS 種別・`PYTHON` で上書きされているかの3つだけで、
  **環境変数そのものは返さない**（`.env.local` に EDINET の APIキーがあるため）。
  「銘柄を選び直す」ボタンを削除しても壊れないよう、独立したエンドポイントにしている。
- `data.ts` は **引数部分だけ**を持つ `screeningCommandArgs` に変更。
  `generatedCommand` は削除し、`tsc` が未修正の参照を検出できるようにした。
- **`src/pythonCommand.tsx` を新規追加**。`usePythonEnv()` / `buildCommand()` /
  `<PythonBinNote>` を提供し、取得結果はモジュール単位でキャッシュして `fetch` は最大1回。
- コピーボタンは**表示している文字列と同一のもの**をコピーする。

### 静かな劣化を避けるための設計
`/api/env` に問い合わせできなかった場合（dev server が落ちている、静的配信など）は、
`navigator.userAgent` から推定した値を表示するが、
**「ブラウザの OS から推定しています」という注記を必ず併記する**。
推定値を正しい値のように見せない（`CLAUDE.md`「静かな劣化の禁止」）。

### 検証
- `IS_WINDOWS` を一時的に `true` に固定した dev server に **macOS のブラウザ**から接続し、
  画面の表示が `python scripts/fetch_stocks.py ...` になることを確認。
  **表示がブラウザ側の OS ではなくサーバの実値に追従している**ことの確認。検証後に復帰済み。
- `PYTHON=py npm run dev` → `{"pythonBin":"py","pythonFromEnv":true}` を確認。
- 表示文字列とクリップボードの内容が**完全一致**することを確認（Playwright）。
- `/api/env` を `route.abort()` で失敗させ、推定である旨の注記が出ることを確認。
- `/api/screening-status` など既存エンドポイントへの影響なし。`tsc --noEmit` / `vite build` OK。
- コンソールエラー（`pageerror`）なし。

### 制限事項
BUG-018 と同様、**Windows 実機での確認はできていない**。
ただし本件は「サーバが `process.platform` を見て答える」という単一の分岐に集約されており、
その分岐を強制した状態での表示は上記のとおり確認済み。

---

## BUG-020: Windows の Python は日本語を print しただけで落ちる

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-020 |
| 起票日 | 2026-09-23 |
| Severity | medium |
| Status | resolved |
| 対象ファイル | `scripts/tests/tz_check.py` |
| 発見経路 | **GitHub Actions の `windows-latest` で実際に落ちた**（BUG-019 で追加した platform-check の初回実行） |

### 再現手順
1. Windows で日本語を `print()` する Python スクリプトを実行する
   （`PYTHONIOENCODING=cp1252` で他OSでも再現できる）

### 期待する動作
ログが表示される。

### 実際の動作
1行目で異常終了する。

```
UnicodeEncodeError: 'charmap' codec can't encode characters in position 6-9:
character maps to <undefined>
  File "...\encodings\cp1252.py", line 19, in encode
```

### 原因
Windows の Python は標準出力の既定エンコーディングが **cp1252** で、
日本語を含む文字列を書き出せない。
このプロジェクトのログはすべて日本語なので、**1行 print した時点で落ちる**。

`scripts/` 配下の既存スクリプト6本はすべて
`sys.stdout.reconfigure(encoding='utf-8')` を持っていたが、
BUG-019 で新規追加した `scripts/tests/tz_check.py` だけ付け忘れていた。

**アプリ本体には影響しない**（既存スクリプトは対策済み）。
ただし「既存コードに入っていた対策が実際に必須だった」ことが
**実機で初めて裏付けられた**という意味がある。
これまで macOS でしか動かしていなかったため、この対策は
効果を確認できないまま入っていた。

### 対応（2026-09-23）
- `tz_check.py` に他スクリプトと同じ `reconfigure` を追加。
- **抜けを機械的に検出するチェックを追加**（`tz_check.py` の項目⑥）。
  `scripts/**/*.py` を走査し、`reconfigure(encoding` を持たないファイルがあれば失敗する。
  今後スクリプトを新規追加したときに同じ忘れ方をしても CI が止める。

### 検証
- `PYTHONIOENCODING=cp1252 python3 scripts/tests/tz_check.py` → 全項目通過。
- 対策行を外した複製を cp1252 で実行 → **終了コード1・`UnicodeEncodeError`** を再現。
  「対策があるから通っている」ことを両方向から確認した。
- 新しいチェック⑥が、対策の無いファイルを実際に検出することを確認。

### 備考
`print()` の代わりに `sys.stdout.buffer.write()` や `io.TextIOWrapper` を被せる方法もあるが、
`TextIOWrapper` は別スクリプトから import されたときに前のラッパーが破棄され
元の buffer ごと閉じられる問題があるため、既存コードと同じ `reconfigure` に揃えた。

---

## BUG-021: Windows のコマンド未検出は終了コード 9009 ではなく 1 だった

| 項目 | 内容 |
|---|---|
| Bug ID | BUG-021 |
| 起票日 | 2026-09-23 |
| Severity | medium |
| Status | resolved |
| 対象ファイル | `vite-plugin-macro.ts`, `CLAUDE.md`, `scripts/tests/platform_check.mjs` |
| 発見経路 | **GitHub Actions の `windows-latest`**（BUG-019 で追加した platform-check） |

### 再現手順
1. Windows で `PYTHON=存在しないコマンド名 npm run dev` を実行する
2. 「株価を更新」または「銘柄を選び直す」ボタンを押す

### 期待する動作
「'<コマンド名>' コマンドが見つかりません。環境変数 PYTHON で指定してください」と案内が出る。

### 実際の動作
```
refresh_prices.py が失敗 (exit=1)
```
案内が出ない。**BUG-018 で直したはずの「原因不明の失敗」が Windows では残っていた。**

進捗ログには cmd.exe の出力が届いている。
```
[py-err] 'python_does_not_exist_9009' is not recognized as an internal or external command,
[py-err] operable program or batch file.
```
つまり cmd.exe は正しく検出しているのに、**Node が受け取る終了コードが 1** だった。

### 原因
BUG-018 で「Windows の cmd.exe はコマンド未検出時に 9009 を返す」という前提で
`isCommandNotFound(code) { return code === 127 || code === 9009; }` を書いた。
この前提が実機で成り立たなかった。

macOS では 127（`shell: true` 経路）と ENOENT（`shell: false` 経路）の両方が
期待どおり出ていたため、**macOS だけ見ていては絶対に気づけない**種類の誤りだった。

なお `stderr` の文言で判定する案もあるが、
**OS の言語設定で文言が変わる**（日本語版 Windows は日本語で出る）ため採用しなかった。

### 対応（2026-09-23）
終了コードや文言から**推測するのをやめ、実地に確かめる**方式に変えた。

- `commandExists(cmd)` を追加。`where`（Windows）/ `which`（Unix系）を
  `shell: false` で起動し、**その終了コード**で判定する。言語設定に依存しない。
  `.bat` / `.cmd` のラッパーも `where` は見つけられる（conda 環境で誤検知しない）。
  区切り文字を含む値（フルパス指定）は `existsSync` で判定する。
- `pythonNotFoundSuffix(code)` に集約し、3箇所の `close` ハンドラで共通に使う。
  終了コード判定は「速い経路」として残し、最終判断は実地確認に委ねる。
- **`CLAUDE.md` のルール2を書き換えた。** 「終了コードは OS ごとに違う」から
  「**終了コードで原因を判定しない**」に改め、実測で裏切られた事実を明記した。
- **誤検知チェックを追加**（`platform_check.mjs`）。
  Python が実在する状態でスクリプトが失敗したとき、
  「見つかりません」と**言わない**ことを確認する。
  誤って常に案内を出す実装にしてもテストが通ってしまうのを防ぐため。

### 検証
- macOS ローカル: 127 経路・ENOENT 経路の両方で案内が出ることを再確認。
- 誤検知チェック: `screening_result.json` が無い状態の `refresh_prices.py` は
  ネットワークに出る前に exit=1 で終わるため、これを「Python は在るが失敗した」実例として使う。
- Windows 実機（GitHub Actions）での確認結果は `docs/specs/ci_platform_check.md` の実行履歴を参照。

### 教訓
この不具合は、**「動くはず」で済ませていた箇所が実際には動いていなかった**という
BUG-018 と全く同じ構図で、しかも BUG-018 の修正自体に含まれていた。
プラットフォーム差は仕様の記述ではなく**実機の挙動で確認する**しかない。
